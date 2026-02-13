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
      await initTidalClient();
      const limit = options.limit ?? 10;
      const artists = await getSimilarArtists(parseInt(artistId, 10), limit);
      const plain = program.opts().plain;
      console.log(plain ? plainArtists(artists) : JSON.stringify({ count: artists.length, artists }, null, 2));
    });
}
