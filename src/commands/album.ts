import { Command } from "commander";
import { installNodeStorage } from "../services/nodeStorage";
import { initTidalClient, getAlbumDetails, getSimilarAlbums } from "../services/tidal";

installNodeStorage();

export function registerAlbumCommand(program: Command): void {
  const album = program
    .command("album")
    .description("Album information");

  album
    .command("info <album-id>")
    .description("Get album details")
    .action(async (albumId: string) => {
      await initTidalClient();
      const details = await getAlbumDetails(albumId);
      console.log(JSON.stringify(details, null, 2));
    });

  album
    .command("similar <album-id>")
    .description("Get similar albums")
    .option("--limit <count>", "Max results", (v) => Number.parseInt(v, 10))
    .action(async (albumId: string, options: { limit?: number }) => {
      await initTidalClient();
      const similar = await getSimilarAlbums(albumId, options.limit ?? 10);
      console.log(JSON.stringify({ count: similar.length, albums: similar }, null, 2));
    });
}
