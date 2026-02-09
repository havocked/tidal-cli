const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { WebSocketServer } = require("ws");
const { getTargets, findMainTarget, evaluate } = require("../dist/services/cdp");

// Helper: create a mock CDP server
function createMockCDPServer(targets, onEval) {
  return new Promise((resolve) => {
    const httpServer = http.createServer((req, res) => {
      if (req.url === "/json" || req.url === "/json/list") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(targets));
      } else if (req.url === "/json/version") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ Browser: "TIDAL" }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    const wss = new WebSocketServer({ server: httpServer });
    wss.on("connection", (ws) => {
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.method === "Runtime.evaluate" && onEval) {
          const value = onEval(msg.params.expression);
          ws.send(
            JSON.stringify({
              id: msg.id,
              result: { result: { type: typeof value, value } },
            })
          );
        }
      });
    });

    httpServer.listen(0, () => {
      const port = httpServer.address().port;
      // Patch target URLs with actual port
      for (const t of targets) {
        t.webSocketDebuggerUrl = `ws://localhost:${port}`;
      }
      resolve({ port, close: () => { wss.close(); httpServer.close(); } });
    });
  });
}

test("getTargets fetches and parses CDP targets", async () => {
  const mockTargets = [
    { id: "1", title: "TIDAL", type: "page", url: "https://desktop.tidal.com/", webSocketDebuggerUrl: "" },
    { id: "2", title: "SW", type: "service_worker", url: "https://desktop.tidal.com/sw.js", webSocketDebuggerUrl: "" },
  ];
  const server = await createMockCDPServer(mockTargets);

  try {
    const config = { cdpPort: server.port, connectTimeoutMs: 3000, navigationWaitMs: 1000, appPath: "" };
    const targets = await getTargets(config);
    assert.equal(targets.length, 2);
    assert.equal(targets[0].title, "TIDAL");
    assert.equal(targets[0].type, "page");
  } finally {
    server.close();
  }
});

test("findMainTarget returns the desktop.tidal.com page", async () => {
  const mockTargets = [
    { id: "sw", title: "SW", type: "service_worker", url: "https://desktop.tidal.com/sw.js", webSocketDebuggerUrl: "" },
    { id: "main", title: "TIDAL", type: "page", url: "https://desktop.tidal.com/", webSocketDebuggerUrl: "" },
  ];
  const server = await createMockCDPServer(mockTargets);

  try {
    const config = { cdpPort: server.port, connectTimeoutMs: 3000, navigationWaitMs: 1000, appPath: "" };
    const target = await findMainTarget(config);
    assert.equal(target.id, "main");
    assert.equal(target.type, "page");
  } finally {
    server.close();
  }
});

test("findMainTarget throws if no page target found", async () => {
  const mockTargets = [
    { id: "sw", title: "SW", type: "service_worker", url: "https://other.com/", webSocketDebuggerUrl: "" },
  ];
  const server = await createMockCDPServer(mockTargets);

  try {
    const config = { cdpPort: server.port, connectTimeoutMs: 3000, navigationWaitMs: 1000, appPath: "" };
    await assert.rejects(() => findMainTarget(config), /Could not find TIDAL main page/);
  } finally {
    server.close();
  }
});

test("evaluate executes JS and returns result", async () => {
  const mockTargets = [
    { id: "1", title: "TIDAL", type: "page", url: "https://desktop.tidal.com/", webSocketDebuggerUrl: "" },
  ];
  const server = await createMockCDPServer(mockTargets, (expr) => {
    if (expr === "1 + 2") return 3;
    if (expr === '"hello"') return "hello";
    return null;
  });

  try {
    const config = { cdpPort: server.port, connectTimeoutMs: 3000, navigationWaitMs: 1000, appPath: "" };
    const result = await evaluate(config, "1 + 2");
    assert.equal(result, 3);

    const strResult = await evaluate(config, '"hello"');
    assert.equal(strResult, "hello");
  } finally {
    server.close();
  }
});

test("getTargets throws on connection refused", async () => {
  const config = { cdpPort: 19999, connectTimeoutMs: 1000, navigationWaitMs: 1000, appPath: "" };
  await assert.rejects(() => getTargets(config), /Cannot connect to TIDAL/);
});
