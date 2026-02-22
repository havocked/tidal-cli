import { Command } from "commander";
import fs from "fs";
import http from "http";
import { URL } from "url";
import * as auth from "@tidal-music/auth";
import { installNodeStorage } from "../services/nodeStorage";
import { expandHome } from "../lib/paths";
import { loadCredentials, initTidalClient, getCurrentUser } from "../services/tidal";

installNodeStorage();

const REDIRECT_URI = "http://localhost:8080/callback";
const CREDENTIALS_STORAGE_KEY = "tidal-cli-auth";

const AUTH_SCOPES = ["user.read", "collection.read", "playlists.read", "playlists.write", "recommendations.read"];

async function initAuth(): Promise<void> {
  const { clientId, clientSecret } = loadCredentials();
  await auth.init({
    clientId,
    clientSecret,
    credentialsStorageKey: CREDENTIALS_STORAGE_KEY,
    scopes: AUTH_SCOPES,
  });
}

async function loginWithBrowser(): Promise<void> {
  await initAuth();

  // Use SDK's own login initializer (handles PKCE internally)
  const loginUrl = await auth.initializeLogin({
    redirectUri: REDIRECT_URI,
  });

  const { default: open } = await import("open");
  console.log("Opening browser for TIDAL login...");
  console.log(`If it doesn't open, visit: ${loginUrl}`);
  await open(loginUrl);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;
    let server: http.Server | undefined;

    const finish = (error?: unknown): void => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (server) {
        try {
          server.close();
        } catch {
          // ignore close races
        }
      }

      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      } else {
        resolve();
      }
    };

    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "", REDIRECT_URI);
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h2>Error: ${error}</h2><p>You can close this window.</p>`);
        finish(new Error(error));
        return;
      }

      const code = url.searchParams.get("code");
      if (code) {
        try {
          // Pass the full query string to SDK's finalizeLogin
          // It extracts the code and exchanges it for tokens internally
          await auth.finalizeLogin(url.search);

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<h2>✅ Authorization successful!</h2><p>You can close this window.</p>"
          );
          finish();
        } catch (err) {
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end(`<h2>Token exchange failed</h2><p>${err}</p>`);
          finish(err);
        }
      } else {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h2>Missing authorization code.</h2>");
      }
    });

    server.on("error", (err) => {
      finish(new Error(`Failed to start OAuth callback server on port 8080: ${err.message}`));
    });

    server.listen(8080, () => {
      console.log("Waiting for authorization...");
    });

    // Timeout after 2 minutes
    timeout = setTimeout(() => {
      finish(new Error("Login timed out after 2 minutes"));
    }, 120_000);
    timeout.unref();
  });
}

async function checkStatus(): Promise<void> {
  try {
    await initAuth();
    const credentials = await auth.credentialsProvider.getCredentials();

    if (credentials && "token" in credentials && credentials.token) {
      const userId = "userId" in credentials ? credentials.userId : null;

      if (!userId) {
        console.log(
          "⚠️  Client credentials only (no user session). Run: tidal-cli auth login"
        );
        return;
      }

      console.log("✅ Logged in");
      console.log(`User ID: ${String(userId)}`);
      console.log("Token: present");

      if ("expires" in credentials && typeof credentials.expires === "number") {
        const expiresIn = Math.round((credentials.expires - Date.now()) / 1000);
        if (expiresIn > 0) {
          console.log(`Expires in: ${Math.round(expiresIn / 60)} minutes`);
        } else {
          console.log("Token expired (will auto-refresh on next use)");
        }
      }

      // Fetch user profile
      try {
        await initTidalClient();
        const user = await getCurrentUser();
        if (user.username) console.log(`Username: ${user.username}`);
        if (user.email) console.log(`Email: ${user.email}`);
        if (user.firstName || user.lastName) {
          console.log(`Name: ${[user.firstName, user.lastName].filter(Boolean).join(" ")}`);
        }
        if (user.country) console.log(`Country: ${user.country}`);
      } catch {
        // Profile fetch is best-effort
      }
    } else {
      console.log("❌ Not logged in. Run: tidal-cli auth login");
    }
  } catch {
    console.log("❌ Not logged in. Run: tidal-cli auth login");
  }
}

async function logout(): Promise<void> {
  const storagePath = expandHome("~/.config/tidal-cli/auth-storage.json");
  if (fs.existsSync(storagePath)) {
    fs.writeFileSync(storagePath, "{}");
    console.log("✅ Logged out (credentials cleared)");
  } else {
    console.log("Already logged out.");
  }
}

export function registerAuthCommand(program: Command): void {
  const authCmd = program
    .command("auth")
    .description("Manage TIDAL authentication");

  authCmd
    .command("login")
    .description("Log in with your TIDAL account")
    .action(async () => {
      try {
        await loginWithBrowser();
        console.log("✅ Successfully logged in!");
        // Verify it worked
        await checkStatus();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Login failed: ${message}`);
        process.exit(1);
      }
    });

  authCmd
    .command("status")
    .description("Check authentication status")
    .action(async () => {
      await checkStatus();
    });

  authCmd
    .command("logout")
    .description("Clear stored credentials")
    .action(async () => {
      await logout();
    });
}
