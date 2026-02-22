import { Command } from "commander";
import { installNodeStorage } from "../services/nodeStorage";
import { initTidalClient, getSimilarArtists } from "../services/tidal";
import { plainArtists } from "../lib/formatter";

installNodeStorage();

type SimilarOptions = {
  limit?: number;
};

export function registerSimilarCommand(program: Command): void {
  program
    .command("similar <artist-id>")
    .description("Show similar artists")
    .option("--limit <count>", "Max results (default: 10)", (v) => Number.parseInt(v, 10))
    .action(async (artistId: string, options: SimilarOptions) => {
      const parsedArtistId = Number.parseInt(artistId, 10);
      if (Number.isNaN(parsedArtistId)) {
        console.error("artist-id must be a numeric TIDAL artist ID");
        process.exitCode = 1;
        return;
      }

      await initTidalClient();
      const limit = options.limit ?? 10;
      const artists = await getSimilarArtists(parsedArtistId, limit);
      const plain = program.opts().plain;
      console.log(plain ? plainArtists(artists) : JSON.stringify({ count: artists.length, artists }, null, 2));
    });
}
