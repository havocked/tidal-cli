import { Command } from "commander";
import { logger } from "../lib/logger";
import { installNodeStorage } from "../services/nodeStorage";
import {
  initTidalClient,
  searchTracks,
  searchArtists,
  searchAlbums,
  searchPlaylists,
  searchTopHits,
} from "../services/tidal";
import { plainTracks, plainArtists, plainAlbums, plainPlaylists } from "../lib/formatter";

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
    .option("--type <type>", "Search type (track|album|artist|playlist|top)", "track")
    .action(async (query: string, options: SearchOptions) => {
      logger.info(`search: "${query}"`, { type: options.type ?? "track", limit: options.limit ?? 20 });
      logger.verbose("Search query details", { query, type: options.type, limit: options.limit });
      await initTidalClient();
      const limit = options.limit ?? 20;
      const type = (options.type ?? "track").toLowerCase();
      const plain = program.opts().plain;

      switch (type) {
        case "artist":
        case "artists": {
          const artist = await searchArtists(query);
          if (!artist) {
            console.error("No artist found.");
            process.exitCode = 1;
            return;
          }
          console.log(plain ? `${artist.id}\t${artist.name}` : JSON.stringify(artist, null, 2));
          break;
        }
        case "album":
        case "albums": {
          const albums = await searchAlbums(query, limit);
          console.log(plain ? plainAlbums(albums) : JSON.stringify({ count: albums.length, albums }, null, 2));
          break;
        }
        case "playlist":
        case "playlists": {
          const playlists = await searchPlaylists(query, limit);
          console.log(plain ? plainPlaylists(playlists) : JSON.stringify({ count: playlists.length, playlists }, null, 2));
          break;
        }
        case "top":
        case "tophits": {
          const tracks = await searchTopHits(query, limit);
          console.log(plain ? plainTracks(tracks) : JSON.stringify({ count: tracks.length, tracks }, null, 2));
          break;
        }
        default: {
          const tracks = await searchTracks(query, limit);
          console.log(plain ? plainTracks(tracks) : JSON.stringify({ count: tracks.length, tracks }, null, 2));
          logger.done("search completed", { type, resultCount: tracks.length });
          break;
        }
      }
    });
}
