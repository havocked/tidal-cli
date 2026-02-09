import WebSocket from "ws";
import http from "http";
import { TidalCliConfig } from "../lib/config";

export type CDPTarget = {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
};

/**
 * Discover available CDP targets from the TIDAL app.
 */
export async function getTargets(config: TidalCliConfig): Promise<CDPTarget[]> {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:${config.cdpPort}/json`;
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data) as CDPTarget[]);
        } catch (e) {
          reject(new Error(`Failed to parse CDP targets: ${e}`));
        }
      });
    });
    req.on("error", (e) => {
      reject(
        new Error(
          `Cannot connect to TIDAL on port ${config.cdpPort}. Is TIDAL running with --remote-debugging-port=${config.cdpPort}?\n${e.message}`
        )
      );
    });
    req.setTimeout(config.connectTimeoutMs, () => {
      req.destroy();
      reject(new Error("Connection to TIDAL timed out"));
    });
  });
}

/**
 * Find the main TIDAL page target (desktop.tidal.com).
 */
export async function findMainTarget(
  config: TidalCliConfig
): Promise<CDPTarget> {
  const targets = await getTargets(config);
  const main = targets.find(
    (t) => t.type === "page" && t.url.includes("desktop.tidal.com")
  );
  if (!main) {
    throw new Error(
      "Could not find TIDAL main page. Targets: " +
        targets.map((t) => `${t.type}:${t.url}`).join(", ")
    );
  }
  return main;
}

/**
 * Evaluate a JavaScript expression in the TIDAL renderer process.
 * Returns the result value.
 */
export async function evaluate(
  config: TidalCliConfig,
  expression: string,
  options?: { awaitPromise?: boolean }
): Promise<unknown> {
  const target = await findMainTarget(config);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error("CDP evaluation timed out"));
      }
    }, config.connectTimeoutMs);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            expression,
            returnByValue: true,
            awaitPromise: options?.awaitPromise ?? false,
          },
        })
      );
    });

    ws.on("message", (data) => {
      if (settled) return;
      try {
        const msg = JSON.parse(data.toString()) as {
          id?: number;
          result?: {
            result?: { type?: string; value?: unknown; description?: string };
            exceptionDetails?: { text?: string; exception?: { description?: string } };
          };
        };
        if (msg.id === 1) {
          settled = true;
          clearTimeout(timeout);
          ws.close();

          if (msg.result?.exceptionDetails) {
            const ex = msg.result.exceptionDetails;
            reject(
              new Error(
                ex.exception?.description ?? ex.text ?? "JS evaluation error"
              )
            );
          } else {
            resolve(msg.result?.result?.value);
          }
        }
      } catch (e) {
        settled = true;
        clearTimeout(timeout);
        ws.close();
        reject(e);
      }
    });

    ws.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${err.message}`));
      }
    });
  });
}

/**
 * Navigate the TIDAL app to a URL and optionally wait for it to load.
 */
export async function navigate(
  config: TidalCliConfig,
  url: string
): Promise<void> {
  await evaluate(config, `window.location.href = ${JSON.stringify(url)}`);
  // Wait for the page to render
  await new Promise((r) => setTimeout(r, config.navigationWaitMs));
}

/**
 * Click a button by its aria-label. Optionally scope to a container selector.
 * Returns true if a button was found and clicked.
 */
export async function clickButton(
  config: TidalCliConfig,
  ariaLabel: string,
  options?: { container?: string; index?: number }
): Promise<boolean> {
  const container = options?.container
    ? `document.querySelector(${JSON.stringify(options.container)})`
    : "document";
  const idx = options?.index ?? 0;

  const result = await evaluate(
    config,
    `(() => {
      const root = ${container} || document;
      const btns = [...root.querySelectorAll('button[aria-label="${ariaLabel}"]')];
      if (btns[${idx}]) { btns[${idx}].click(); return true; }
      return false;
    })()`
  );
  return result === true;
}
