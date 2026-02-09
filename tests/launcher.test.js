const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { isCDPAvailable } = require("../dist/services/launcher");

test("isCDPAvailable returns true when CDP responds with TIDAL", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ Browser: "TIDAL/Electron" }));
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const result = await isCDPAvailable({
      cdpPort: port,
      connectTimeoutMs: 2000,
      navigationWaitMs: 1000,
      appPath: "",
    });
    assert.equal(result, true);
  } finally {
    server.close();
  }
});

test("isCDPAvailable returns false when nothing is listening", async () => {
  const result = await isCDPAvailable({
    cdpPort: 19998,
    connectTimeoutMs: 1000,
    navigationWaitMs: 1000,
    appPath: "",
  });
  assert.equal(result, false);
});

test("isCDPAvailable returns false when response doesn't mention TIDAL", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ Browser: "Chrome" }));
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const result = await isCDPAvailable({
      cdpPort: port,
      connectTimeoutMs: 2000,
      navigationWaitMs: 1000,
      appPath: "",
    });
    assert.equal(result, false);
  } finally {
    server.close();
  }
});
