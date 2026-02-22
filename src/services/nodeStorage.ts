import fs from "fs";
import os from "os";
import path from "path";

/**
 * A minimal localStorage-compatible adapter for Node.js.
 * Stores auth tokens in ~/.config/tidal-cli/auth-storage.json.
 */
class NodeStorage implements Storage {
  private storePath: string;
  private cache: Record<string, string> = {};

  constructor() {
    this.storePath = path.join(
      os.homedir(),
      ".config",
      "tidal-cli",
      "auth-storage.json"
    );
    this.load();
  }

  private load(): void {
    if (fs.existsSync(this.storePath)) {
      try {
        this.cache = JSON.parse(fs.readFileSync(this.storePath, "utf-8"));
      } catch {
        this.cache = {};
      }
    }
  }

  private save(): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storePath, JSON.stringify(this.cache, null, 2));
  }

  get length(): number {
    return Object.keys(this.cache).length;
  }

  clear(): void {
    this.cache = {};
    this.save();
  }

  getItem(key: string): string | null {
    return this.cache[key] || null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.cache);
    return keys[index] || null;
  }

  removeItem(key: string): void {
    delete this.cache[key];
    this.save();
  }

  setItem(key: string, value: string): void {
    this.cache[key] = value;
    this.save();
  }
}

// globalThis polyfills for Node.js — the Tidal SDK expects browser globals
const g = globalThis as Record<string, unknown>;

export function installNodeStorage(): void {
  g.localStorage = new NodeStorage();

  if (typeof g.dispatchEvent === "undefined") {
    g.dispatchEvent = () => true;
    g.addEventListener = () => {};
    g.removeEventListener = () => {};
  }
}
