import { Command } from "commander";
import { installNodeStorage } from "../services/nodeStorage";
import { initTidalClient, getTrackRadio, getArtistRadio } from "../services/tidal";
import { plainTracks } from "../lib/formatter";

installNodeStorage();

type RadioOptions = {
  limit?: number;
  artist?: boolean;
};

export function registerRadioCommand(program: Command): void {
  program
    .command("radio <id>")
    .description("Get radio tracks based on a track or artist")
    .option("--limit <count>", "Max results (default: 20)", (v) => Number.parseInt(v, 10))
    .option("--artist", "Treat ID as artist ID (default: track ID)")
    .action(async (id: string, options: RadioOptions) => {
      await initTidalClient();
      const limit = options.limit ?? 20;

      const tracks = options.artist
        ? await getArtistRadio(parseInt(id, 10), limit)
        : await getTrackRadio(id, limit);

      const plain = program.opts().plain;
      console.log(plain ? plainTracks(tracks) : JSON.stringify({ count: tracks.length, tracks }, null, 2));
    });
}
