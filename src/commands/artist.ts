import { Command } from "commander";
import { installNodeStorage } from "../services/nodeStorage";
import { initTidalClient, getArtistDetails } from "../services/tidal";
import { plainKV } from "../lib/formatter";

installNodeStorage();

export function registerArtistCommand(program: Command): void {
  const artist = program
    .command("artist")
    .description("Artist information");

  artist
    .command("info <artist-id>")
    .description("Get artist details")
    .action(async (artistId: string) => {
      await initTidalClient();
      const details = await getArtistDetails(artistId);
      const plain = program.opts().plain;
      console.log(plain ? plainKV(details as Record<string, unknown>) : JSON.stringify(details, null, 2));
    });
}
