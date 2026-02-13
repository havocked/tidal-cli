import fs from "fs";
import path from "path";
import os from "os";

export type LogLevel = "debug" | "verbose" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  verbose: 1,
  info: 2,
  warn: 3,
  error: 4,
};

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  data?: Record<string, unknown>;
}

interface LoggerOptions {
  verbose?: boolean;
  debug?: boolean;
  logFile?: string;
}

const MAX_PERSISTENT_LOG_SIZE = 1_000_000; // 1MB

class Logger {
  private minLevel: LogLevel = "info";
  private logFilePath: string | null = null;
  private persistentLogPath: string;
  private isTTY: boolean;
  private commandStart: number = 0;

  constructor() {
    this.isTTY = process.stderr.isTTY === true;
    const dataDir = path.join(os.homedir(), ".local", "share", "tidal-cli");
    this.persistentLogPath = path.join(dataDir, "tidal.log");
  }

  init(options: LoggerOptions): void {
    if (options.debug) {
      this.minLevel = "debug";
    } else if (options.verbose) {
      this.minLevel = "verbose";
    } else {
      this.minLevel = "info";
    }
    this.logFilePath = options.logFile ?? null;

    // Ensure persistent log directory exists
    const dir = path.dirname(this.persistentLogPath);
    fs.mkdirSync(dir, { recursive: true });

    // Auto-rotate persistent log
    this.rotatePersistentLog();
  }

  startTimer(): void {
    this.commandStart = Date.now();
  }

  elapsed(): number {
    return this.commandStart ? Date.now() - this.commandStart : 0;
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.log("debug", msg, data);
  }

  verbose(msg: string, data?: Record<string, unknown>): void {
    this.log("verbose", msg, data);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log("info", msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log("warn", msg, data);
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.log("error", msg, data);
  }

  /** Log command completion with timing */
  done(msg: string, data?: Record<string, unknown>): void {
    const ms = this.elapsed();
    this.info(msg, { ...data, durationMs: ms });
  }

  private log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...(data && Object.keys(data).length > 0 ? { data } : {}),
    };

    const jsonLine = JSON.stringify(entry);

    // Always write to persistent log
    this.writePersistent(jsonLine);

    // Write to user-specified log file
    if (this.logFilePath) {
      this.writeFile(this.logFilePath, jsonLine);
    }

    // Write to stderr if level is high enough
    if (LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel]) {
      this.writeStderr(level, msg, data);
    }
  }

  private writeStderr(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    let line: string;
    const dataStr = data && Object.keys(data).length > 0
      ? ` ${JSON.stringify(data)}`
      : "";

    if (this.isTTY) {
      line = `${this.colorize(level, `[${level}]`)} ${msg}${this.dim(dataStr)}\n`;
    } else {
      line = `[${level}] ${msg}${dataStr}\n`;
    }
    process.stderr.write(line);
  }

  private colorize(level: LogLevel, text: string): string {
    switch (level) {
      case "debug": return `\x1b[2m${text}\x1b[0m`;      // dim
      case "verbose": return `\x1b[2m${text}\x1b[0m`;     // dim
      case "info": return `\x1b[36m${text}\x1b[0m`;       // cyan
      case "warn": return `\x1b[33m${text}\x1b[0m`;       // yellow
      case "error": return `\x1b[31m${text}\x1b[0m`;      // red
    }
  }

  private dim(text: string): string {
    if (!text) return "";
    return this.isTTY ? `\x1b[2m${text}\x1b[0m` : text;
  }

  private writePersistent(jsonLine: string): void {
    try {
      fs.appendFileSync(this.persistentLogPath, jsonLine + "\n");
    } catch {
      // silently ignore
    }
  }

  private writeFile(filePath: string, jsonLine: string): void {
    try {
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(filePath, jsonLine + "\n");
    } catch {
      // silently ignore
    }
  }

  private rotatePersistentLog(): void {
    try {
      const stat = fs.statSync(this.persistentLogPath);
      if (stat.size > MAX_PERSISTENT_LOG_SIZE) {
        // Keep last half of the file
        const content = fs.readFileSync(this.persistentLogPath, "utf-8");
        const lines = content.split("\n");
        const half = Math.floor(lines.length / 2);
        fs.writeFileSync(this.persistentLogPath, lines.slice(half).join("\n"));
      }
    } catch {
      // File doesn't exist yet, that's fine
    }
  }
}

/** Singleton logger instance */
export const logger = new Logger();

/**
 * Legacy log function for backward compatibility.
 * Writes to stderr to keep stdout clean for machine output.
 */
export function log(message: string): void {
  process.stderr.write(`${message}\n`);
}
