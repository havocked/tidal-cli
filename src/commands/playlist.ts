import { Command } from "commander";
import {
  addTracksToPlaylist,
  createPlaylist,
  deletePlaylist,
  removeTracksFromPlaylist,
  updatePlaylist,
  initTidalClient,
} from "../services/tidal";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk: string) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(chunks.join("")));
    process.stdin.on("error", reject);

    // If stdin is a TTY (no pipe), don't hang
    if (process.stdin.isTTY) {
      resolve("");
    }
  });
}

function parseTrackIds(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line));
}

type PlaylistCreateOptions = {
  name: string;
  description?: string;
  public?: boolean;
};

async function runPlaylistCreate(options: PlaylistCreateOptions): Promise<void> {
  const raw = await readStdin();
  const trackIds = parseTrackIds(raw);

  if (trackIds.length === 0) {
    throw new Error(
      "No track IDs provided. Pipe IDs via stdin:\n  tidal-cli playlist create --name \"Jazz Mix\" < track-ids.txt"
    );
  }

  console.error(`[playlist] Creating playlist: ${options.name}`);
  console.error(`[playlist] ${trackIds.length} tracks to add`);

  await initTidalClient();

  const playlist = await createPlaylist({
    name: options.name,
    description: options.description,
    isPublic: options.public ?? false,
  });

  console.error(`[playlist] Created: ${playlist.name} (${playlist.id})`);

  const added = await addTracksToPlaylist(playlist.id, trackIds);
  console.error(`[playlist] Added ${added} tracks`);

  // Output result as JSON
  const output = {
    id: playlist.id,
    name: playlist.name,
    trackCount: added,
    url: `https://listen.tidal.com/playlist/${playlist.id}`,
  };
  console.log(JSON.stringify(output, null, 2));
}

export function registerPlaylistCommand(program: Command): void {
  const playlist = program
    .command("playlist")
    .description("Manage Tidal playlists");

  playlist
    .command("create")
    .description("Create a Tidal playlist from track IDs (reads from stdin)")
    .requiredOption("--name <name>", "Playlist name")
    .option("--description <text>", "Playlist description")
    .option("--public", "Make playlist public (default: unlisted)")
    .action(async (options: PlaylistCreateOptions) => {
      await runPlaylistCreate(options);
    });

  playlist
    .command("delete <playlist-id>")
    .description("Delete a playlist")
    .action(async (playlistId: string) => {
      await initTidalClient();
      await deletePlaylist(playlistId);
      console.error(`[playlist] Deleted: ${playlistId}`);
      console.log(JSON.stringify({ deleted: playlistId }));
    });

  playlist
    .command("remove <playlist-id> <track-ids...>")
    .description("Remove tracks from a playlist")
    .action(async (playlistId: string, trackIds: string[]) => {
      await initTidalClient();
      const removed = await removeTracksFromPlaylist(playlistId, trackIds);
      console.error(`[playlist] Removed ${removed} tracks from ${playlistId}`);
      console.log(JSON.stringify({ playlistId, removedCount: removed }));
    });

  playlist
    .command("update <playlist-id>")
    .description("Update a playlist's name and/or description")
    .option("--name <name>", "New playlist name")
    .option("--description <text>", "New playlist description")
    .action(async (playlistId: string, options: { name?: string; description?: string }) => {
      if (!options.name && !options.description) {
        console.error("Provide at least --name or --description");
        process.exitCode = 1;
        return;
      }
      await initTidalClient();
      const attrs: { name?: string; description?: string } = {};
      if (options.name) attrs.name = options.name;
      if (options.description) attrs.description = options.description;
      await updatePlaylist(playlistId, attrs);
      console.log(JSON.stringify({ updated: playlistId, ...attrs }));
    });
}
