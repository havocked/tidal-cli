import { Command } from "commander";
import { installNodeStorage } from "../services/nodeStorage";
import {
  initTidalClient,
  getFavoriteTracks,
  getFavoriteAlbums,
  getFavoriteArtists,
  getUserPlaylists,
} from "../services/tidal";
import { plainTracks, plainArtists, plainAlbums, plainPlaylists } from "../lib/formatter";

installNodeStorage();

type LibraryOptions = {
  limit?: number;
  format?: string;
};

export function registerLibraryCommand(program: Command): void {
  const library = program
    .command("library")
    .description("Browse your TIDAL library");

  library
    .command("tracks")
    .description("List favorite tracks")
    .option("--limit <count>", "Max results (default: 100)", (v) => Number.parseInt(v, 10))
    .option("--format <format>", "Output format: json, ids (default: json)")
    .action(async (options: LibraryOptions) => {
      await initTidalClient();
      const limit = options.limit ?? 100;
      const tracks = await getFavoriteTracks(limit);
      const plain = program.opts().plain;

      if (options.format === "ids") {
        for (const t of tracks) console.log(t.id);
      } else if (plain) {
        console.log(plainTracks(tracks));
      } else {
        console.log(JSON.stringify({ count: tracks.length, tracks }, null, 2));
      }
    });

  library
    .command("albums")
    .description("List favorite albums")
    .option("--limit <count>", "Max results (default: 50)", (v) => Number.parseInt(v, 10))
    .action(async (options: LibraryOptions) => {
      await initTidalClient();
      const limit = options.limit ?? 50;
      const albums = await getFavoriteAlbums(limit);
      const plain = program.opts().plain;
      console.log(plain ? plainAlbums(albums) : JSON.stringify({ count: albums.length, albums }, null, 2));
    });

  library
    .command("artists")
    .description("List favorite artists")
    .option("--limit <count>", "Max results (default: 50)", (v) => Number.parseInt(v, 10))
    .action(async (options: LibraryOptions) => {
      await initTidalClient();
      const limit = options.limit ?? 50;
      const artists = await getFavoriteArtists(limit);
      const plain = program.opts().plain;
      console.log(plain ? plainArtists(artists) : JSON.stringify({ count: artists.length, artists }, null, 2));
    });

  library
    .command("playlists")
    .description("List your playlists")
    .option("--limit <count>", "Max results (default: 50)", (v) => Number.parseInt(v, 10))
    .action(async (options: LibraryOptions) => {
      await initTidalClient();
      const limit = options.limit ?? 50;
      const playlists = await getUserPlaylists(limit);
      const plain = program.opts().plain;
      console.log(plain ? plainPlaylists(playlists) : JSON.stringify({ count: playlists.length, playlists }, null, 2));
    });
}
