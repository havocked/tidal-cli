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

const MIN_PORT = 1;
const MAX_PORT = 65535;

export function loadConfig(): TidalCliConfig {
  const rawPort = process.env.TIDAL_CDP_PORT;
  const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : NaN;
  const cdpPort =
    Number.isFinite(parsedPort) && parsedPort >= MIN_PORT && parsedPort <= MAX_PORT
      ? parsedPort
      : DEFAULT_CONFIG.cdpPort;

  const appPath = process.env.TIDAL_APP_PATH ?? DEFAULT_CONFIG.appPath;

  return {
    ...DEFAULT_CONFIG,
    cdpPort,
    appPath,
  };
}
