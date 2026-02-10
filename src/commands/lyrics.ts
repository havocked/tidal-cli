import { Command } from "commander";
import { installNodeStorage } from "../services/nodeStorage";
import { initTidalClient, getLyrics } from "../services/tidal";

installNodeStorage();

type LyricsOptions = {
  json?: boolean;
};

export function registerLyricsCommand(program: Command): void {
  program
    .command("lyrics <track-id>")
    .description("Show lyrics for a track")
    .option("--json", "Output as JSON")
    .action(async (trackId: string, options: LyricsOptions) => {
      await initTidalClient();
      const result = await getLyrics(trackId);

      if (!result) {
        console.error("No lyrics found for this track.");
        process.exitCode = 1;
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.lyrics);
      }
    });
}
