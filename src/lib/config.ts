import os from "os";
import path from "path";

export type TidalCliConfig = {
  /** CDP WebSocket port for TIDAL desktop app */
  cdpPort: number;
  /** Path to the TIDAL application */
  appPath: string;
  /** Connection timeout in ms */
  connectTimeoutMs: number;
  /** Navigation wait time in ms (after opening a page, before clicking play) */
  navigationWaitMs: number;
};

const DEFAULT_CONFIG: TidalCliConfig = {
  cdpPort: 9222,
  appPath: "/Applications/TIDAL.app",
  connectTimeoutMs: 5000,
  navigationWaitMs: 2000,
};

export function loadConfig(): TidalCliConfig {
  const cdpPort = process.env.TIDAL_CDP_PORT
    ? parseInt(process.env.TIDAL_CDP_PORT, 10)
    : DEFAULT_CONFIG.cdpPort;

  const appPath = process.env.TIDAL_APP_PATH ?? DEFAULT_CONFIG.appPath;

  return {
    ...DEFAULT_CONFIG,
    cdpPort,
    appPath,
  };
}
