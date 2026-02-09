const test = require("node:test");
const assert = require("node:assert/strict");
const { loadConfig } = require("../dist/lib/config");

test("loadConfig returns defaults when no env vars set", () => {
  // Clear any env overrides
  const savedPort = process.env.TIDAL_CDP_PORT;
  const savedPath = process.env.TIDAL_APP_PATH;
  delete process.env.TIDAL_CDP_PORT;
  delete process.env.TIDAL_APP_PATH;

  const config = loadConfig();

  assert.equal(config.cdpPort, 9222);
  assert.equal(config.appPath, "/Applications/TIDAL.app");
  assert.equal(config.connectTimeoutMs, 5000);
  assert.equal(config.navigationWaitMs, 2000);

  // Restore
  if (savedPort !== undefined) process.env.TIDAL_CDP_PORT = savedPort;
  if (savedPath !== undefined) process.env.TIDAL_APP_PATH = savedPath;
});

test("loadConfig respects TIDAL_CDP_PORT env var", () => {
  process.env.TIDAL_CDP_PORT = "9333";
  const config = loadConfig();
  assert.equal(config.cdpPort, 9333);
  delete process.env.TIDAL_CDP_PORT;
});

test("loadConfig respects TIDAL_APP_PATH env var", () => {
  process.env.TIDAL_APP_PATH = "/custom/TIDAL.app";
  const config = loadConfig();
  assert.equal(config.appPath, "/custom/TIDAL.app");
  delete process.env.TIDAL_APP_PATH;
});
