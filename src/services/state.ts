import http from "http";
import { execSync } from "child_process";
import { TidalCliConfig } from "../lib/config";

/**
 * TIDAL application lifecycle states, ordered by readiness.
 *
 * Dead       → process not running
 * Launching  → process exists, CDP port not yet available
 * Connecting → CDP port responds, but main page not loaded
 * Ready      → main page loaded, player UI available, not playing
 * Playing    → actively playing a track
 * Paused     → track loaded but paused
 */
export type TidalState =
  | "Dead"
  | "Launching"
  | "Connecting"
  | "Ready"
  | "Playing"
  | "Paused";

/**
 * Probes used by the state tracker to observe the system.
 * All methods are async to allow easy mocking in tests.
 */
export interface StateProbes {
  /** Returns true if the TIDAL process is running */
  isProcessRunning(): Promise<boolean>;
  /** Returns true if the CDP port responds with a TIDAL/Electron identity */
  isCDPAvailable(port: number): Promise<boolean>;
  /** Returns true if the TIDAL main page (desktop.tidal.com) is loaded in CDP */
  isMainPageLoaded(port: number): Promise<boolean>;
  /** Returns playback state from macOS Now Playing: 'playing' | 'paused' | 'stopped' */
  getPlaybackState(): Promise<"playing" | "paused" | "stopped">;
}

/**
 * Default probes that check the real system.
 */
export function createSystemProbes(): StateProbes {
  return {
    async isProcessRunning(): Promise<boolean> {
      try {
        const out = execSync("pgrep -x TIDAL", {
          encoding: "utf8",
          timeout: 3000,
        });
        return out.trim().length > 0;
      } catch {
        return false;
      }
    },

    async isCDPAvailable(port: number): Promise<boolean> {
      return new Promise((resolve) => {
        const req = http.get(
          `http://localhost:${port}/json/version`,
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () =>
              resolve(data.includes("TIDAL") || data.includes("Electron"))
            );
          }
        );
        req.on("error", () => resolve(false));
        req.setTimeout(2000, () => {
          req.destroy();
          resolve(false);
        });
      });
    },

    async isMainPageLoaded(port: number): Promise<boolean> {
      return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/json`, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const targets = JSON.parse(data) as Array<{
                type: string;
                url: string;
              }>;
              const hasMain = targets.some(
                (t) =>
                  t.type === "page" && t.url.includes("desktop.tidal.com")
              );
              resolve(hasMain);
            } catch {
              resolve(false);
            }
          });
        });
        req.on("error", () => resolve(false));
        req.setTimeout(2000, () => {
          req.destroy();
          resolve(false);
        });
      });
    },

    async getPlaybackState(): Promise<"playing" | "paused" | "stopped"> {
      try {
        const raw = execSync("nowplaying-cli get-raw", {
          encoding: "utf8",
          timeout: 3000,
        });
        const rateMatch = raw.match(
          /kMRMediaRemoteNowPlayingInfoPlaybackRate\s*=\s*"?([^";}\n]+)"?/
        );
        const titleMatch = raw.match(
          /kMRMediaRemoteNowPlayingInfoTitle\s*=\s*"?([^";}\n]+)"?/
        );
        const rate = parseFloat(rateMatch?.[1] ?? "0") || 0;
        const title = titleMatch?.[1]?.trim() ?? "";

        if (!title) return "stopped";
        return rate > 0 ? "playing" : "paused";
      } catch {
        return "stopped";
      }
    },
  };
}

/**
 * Pure observation class — checks system state, never causes side effects.
 * Compose with launcher/player for actions.
 */
export class TidalStateTracker {
  private readonly probes: StateProbes;
  private readonly cdpPort: number;

  constructor(config: Pick<TidalCliConfig, "cdpPort">, probes?: StateProbes) {
    this.cdpPort = config.cdpPort;
    this.probes = probes ?? createSystemProbes();
  }

  /**
   * Determine the current state of the TIDAL app by checking
   * each probe in order (cheapest first).
   */
  async getState(): Promise<TidalState> {
    // 1. Is the process even running?
    const running = await this.probes.isProcessRunning();
    if (!running) return "Dead";

    // 2. Is CDP available?
    const cdp = await this.probes.isCDPAvailable(this.cdpPort);
    if (!cdp) return "Launching";

    // 3. Is the main page loaded?
    const mainPage = await this.probes.isMainPageLoaded(this.cdpPort);
    if (!mainPage) return "Connecting";

    // 4. What's the playback state?
    const playback = await this.probes.getPlaybackState();
    if (playback === "playing") return "Playing";
    if (playback === "paused") return "Paused";

    return "Ready";
  }

  /**
   * Wait until the app reaches at least the target state.
   * States are ordered: Dead < Launching < Connecting < Ready < Playing.
   * Paused is treated as equivalent to Ready for ordering purposes.
   *
   * Returns the actual state reached, or throws on timeout.
   */
  async waitFor(
    target: TidalState,
    timeoutMs: number,
    pollIntervalMs = 500
  ): Promise<TidalState> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const current = await this.getState();
      if (stateRank(current) >= stateRank(target)) {
        return current;
      }
      await sleep(pollIntervalMs);
    }

    // One last check
    const final = await this.getState();
    if (stateRank(final) >= stateRank(target)) {
      return final;
    }

    throw new Error(
      `Timed out waiting for TIDAL state "${target}" after ${timeoutMs}ms (current: "${final}")`
    );
  }
}

/** Numeric rank for state ordering. Higher = more ready. */
function stateRank(state: TidalState): number {
  switch (state) {
    case "Dead":
      return 0;
    case "Launching":
      return 1;
    case "Connecting":
      return 2;
    case "Ready":
      return 3;
    case "Paused":
      return 3; // Paused = has a track loaded, at least as ready as Ready
    case "Playing":
      return 4;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
