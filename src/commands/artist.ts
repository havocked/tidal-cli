import { Command } from "commander";
import { installNodeStorage } from "../services/nodeStorage";
import { initTidalClient, getArtistDetails } from "../services/tidal";

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
      console.log(JSON.stringify(details, null, 2));
    });
}
