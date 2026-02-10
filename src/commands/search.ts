import { Command } from "commander";
import { installNodeStorage } from "../services/nodeStorage";
import { initTidalClient, searchTracks, searchArtists } from "../services/tidal";

installNodeStorage();

type SearchOptions = {
  limit?: number;
  type?: string;
};

export function registerSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("Search TIDAL catalog")
    .option("--limit <count>", "Max results (default: 20)", (v) => Number.parseInt(v, 10))
    .option("--type <type>", "Search type (tracks|artists)", "tracks")
    .action(async (query: string, options: SearchOptions) => {
      await initTidalClient();
      const limit = options.limit ?? 20;
      const type = (options.type ?? "tracks").toLowerCase();

      if (type === "artists") {
        const artist = await searchArtists(query);
        if (!artist) {
          console.error("No artist found.");
          process.exitCode = 1;
          return;
        }
        console.log(JSON.stringify(artist, null, 2));
      } else {
        const tracks = await searchTracks(query, limit);
        console.log(JSON.stringify({ count: tracks.length, tracks }, null, 2));
      }
    });
}
