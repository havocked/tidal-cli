import { Command } from "commander";
import { installNodeStorage } from "../services/nodeStorage";
import { getFavoriteTracks, initTidalClient } from "../services/tidal";

installNodeStorage();

type SyncOptions = {
  limit?: number;
  format?: string;
};

export async function runSync(options: SyncOptions): Promise<void> {
  await initTidalClient();

  const limit = options.limit ?? 500;
  const format = (options.format ?? "json").toLowerCase();

  console.error(`[sync] Fetching favorite tracks (limit: ${limit})...`);
  const tracks = await getFavoriteTracks(limit);
  console.error(`[sync] Got ${tracks.length} tracks`);

  if (format === "ids") {
    console.log(tracks.map((t) => String(t.id)).join("\n"));
  } else {
    console.log(JSON.stringify({ count: tracks.length, tracks }, null, 2));
  }
}

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Fetch favorite tracks from TIDAL")
    .option("--limit <count>", "Max tracks to fetch (default: 500)", (v) => Number.parseInt(v, 10))
    .option("--format <format>", "Output format (json|ids)", "json")
    .action(async (options: SyncOptions) => {
      await runSync(options);
    });
}
