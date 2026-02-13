/**
 * Plain-text output formatter for --plain mode.
 * Produces line-oriented, grep/awk-friendly output.
 *
 * Format: TAB-separated fields, one record per line.
 * First field is always the ID for easy piping.
 */

import type { Track, Artist, Album, Playlist } from "../services/types";

export function plainTrack(t: Track): string {
  return `${t.id}\t${t.artist}\t${t.title}\t${t.album}\t${t.duration}`;
}

export function plainTracks(tracks: Track[]): string {
  return tracks.map(plainTrack).join("\n");
}

export function plainArtist(a: Artist): string {
  return `${a.id}\t${a.name}`;
}

export function plainArtists(artists: Artist[]): string {
  return artists.map(plainArtist).join("\n");
}

export function plainAlbum(a: Album): string {
  return `${a.id}\t${a.artist}\t${a.title}\t${a.releaseYear ?? ""}\t${a.trackCount ?? ""}`;
}

export function plainAlbums(albums: Album[]): string {
  return albums.map(plainAlbum).join("\n");
}

export function plainPlaylist(p: Playlist): string {
  return `${p.id}\t${p.title}`;
}

export function plainPlaylists(playlists: Playlist[]): string {
  return playlists.map(plainPlaylist).join("\n");
}

/** Generic key=value pairs, one per line */
export function plainKV(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}\t${v}`)
    .join("\n");
}
