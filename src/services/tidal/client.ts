import { createAPIClient } from "@tidal-music/api";
import * as auth from "@tidal-music/auth";
import { trueTime } from "@tidal-music/true-time";
import fs from "fs";
import path from "path";
import { expandHome } from "../../lib/paths";
import type { ApiClient, Credentials } from "./types";

// Suppress noisy "TrueTime is not yet synchronized" from SDK internals
const _origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("TrueTime")) return;
  _origWarn.apply(console, args);
};

// --- Singleton State ---

let apiClient: ApiClient | null = null;
let userId: string | null = null;
let initialized = false;

const CREDENTIALS_STORAGE_KEY = "tidal-cli-auth";

// --- Public API ---

export function loadCredentials(): Credentials {
  const configPath = expandHome(
    path.join(process.env.HOME ?? "", ".config", "tidal-cli", "credentials.json")
  );
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing credentials file: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8")) as Credentials;
}

export async function initTidalClient(): Promise<void> {
  if (apiClient) return;

  const { clientId, clientSecret } = loadCredentials();

  if (!initialized) {
    await trueTime.synchronize();
    await auth.init({
      clientId,
      clientSecret,
      credentialsStorageKey: CREDENTIALS_STORAGE_KEY,
      scopes: [
        "user.read",
        "collection.read",
        "playlists.read",
        "playlists.write",
        "recommendations.read",
      ],
    });
    initialized = true;
  }

  // Verify user session (not just client credentials)
  const creds = await auth.credentialsProvider.getCredentials();
  if (!creds || !("token" in creds) || !creds.token) {
    throw new Error("Not logged in. Run: tidal-cli auth login");
  }
  if (!("userId" in creds) || !creds.userId) {
    throw new Error("No user session. Run: tidal-cli auth login");
  }

  userId = String(creds.userId);
  apiClient = createAPIClient(auth.credentialsProvider);

  // Debug middleware: log raw request/response when TIDAL_DEBUG=1
  if (process.env.TIDAL_DEBUG === "1") {
    apiClient.use({
      async onRequest({ request }) {
        console.error(`\n→ ${request.method} ${request.url}`);
        return request;
      },
      async onResponse({ response }) {
        const clone = response.clone();
        const body = await clone.text();
        console.error(`← ${response.status} ${response.statusText}`);
        try {
          console.error(JSON.stringify(JSON.parse(body), null, 2));
        } catch {
          console.error(body.slice(0, 2000));
        }
        return response;
      },
    });
  }
}

export function getClient(): ApiClient {
  if (!apiClient) {
    throw new Error(
      "Tidal client not initialized. Call initTidalClient() first."
    );
  }
  return apiClient;
}

/**
 * Get current user's profile.
 */
export async function getCurrentUser(): Promise<{
  id: string;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
}> {
  if (!apiClient) throw new Error("Tidal client not initialized.");

  const resp = await (apiClient as { GET: Function }).GET("/users/me", {
    params: { query: {} },
  }) as { data?: unknown; error?: unknown };

  if (resp.error) {
    throw new Error(`Failed to get user profile: ${JSON.stringify(resp.error)}`);
  }

  const resource = (resp.data as { data?: { id: string; attributes?: Record<string, unknown> } })?.data;
  const attrs = resource?.attributes ?? {};

  return {
    id: resource?.id ?? userId ?? "unknown",
    username: (attrs.username as string) ?? null,
    email: (attrs.email as string) ?? null,
    firstName: (attrs.firstName as string) ?? null,
    lastName: (attrs.lastName as string) ?? null,
    country: (attrs.country as string) ?? null,
  };
}

export function getUserId(): string {
  if (!userId) {
    throw new Error("No user session. Call initTidalClient() first.");
  }
  return userId;
}
