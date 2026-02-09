import { execSync, spawn } from "child_process";
import http from "http";
import { TidalCliConfig } from "../lib/config";

/**
 * Check if the CDP port is responding.
 */
export async function isCDPAvailable(config: TidalCliConfig): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      `http://localhost:${config.cdpPort}/json/version`,
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data.includes("TIDAL") || data.includes("Electron")));
      }
    );
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Check if TIDAL process is running (regardless of CDP).
 */
export function isTidalRunning(): boolean {
  try {
    const out = execSync("pgrep -f 'TIDAL.app/Contents/MacOS/TIDAL$'", {
      encoding: "utf8",
      timeout: 3000,
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Launch TIDAL with remote debugging enabled.
 * If TIDAL is already running without CDP, it quits it first.
 */
export async function ensureTidalWithCDP(
  config: TidalCliConfig
): Promise<void> {
  // Already available?
  if (await isCDPAvailable(config)) {
    return;
  }

  // Running but without CDP? Quit and relaunch.
  if (isTidalRunning()) {
    console.error(
      "TIDAL is running but CDP is not available. Relaunching with debug port..."
    );
    try {
      execSync('osascript -e \'tell application "TIDAL" to quit\'', {
        timeout: 5000,
      });
    } catch {
      execSync("pkill -f 'TIDAL.app/Contents/MacOS/TIDAL$'", {
        timeout: 3000,
      });
    }
    // Wait for quit
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Launch with CDP
  console.error("Launching TIDAL with remote debugging...");
  spawn(
    "open",
    ["-a", config.appPath, "--args", `--remote-debugging-port=${config.cdpPort}`],
    { detached: true, stdio: "ignore" }
  ).unref();

  // Wait for CDP to become available
  const start = Date.now();
  while (Date.now() - start < 15000) {
    if (await isCDPAvailable(config)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error("Timed out waiting for TIDAL to start with CDP");
}
