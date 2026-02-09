import { execSync } from "child_process";

export type NowPlayingInfo = {
  title: string;
  artist: string;
  album: string;
  isPlaying: boolean;
  /** Duration in seconds */
  duration: number;
  /** Elapsed time in seconds */
  elapsed: number;
};

/**
 * Get current playback info from macOS Now Playing (via nowplaying-cli).
 */
export function getNowPlaying(): NowPlayingInfo {
  try {
    const raw = execSync("nowplaying-cli get-raw", {
      encoding: "utf8",
      timeout: 3000,
    });

    const get = (key: string): string => {
      const match = raw.match(new RegExp(`${key}\\s*=\\s*"?([^";\\n}]+)"?`));
      return match?.[1]?.trim() ?? "";
    };

    const title = get("kMRMediaRemoteNowPlayingInfoTitle");
    const artist = get("kMRMediaRemoteNowPlayingInfoArtist");
    const album = get("kMRMediaRemoteNowPlayingInfoAlbum");
    const rate = parseFloat(get("kMRMediaRemoteNowPlayingInfoPlaybackRate")) || 0;
    const duration =
      parseFloat(get("kMRMediaRemoteNowPlayingInfoDuration")) || 0;
    const elapsed =
      parseFloat(get("kMRMediaRemoteNowPlayingInfoElapsedTime")) || 0;

    return {
      title: cleanTitle(title),
      artist,
      album,
      isPlaying: rate > 0,
      duration,
      elapsed,
    };
  } catch {
    throw new Error(
      "Failed to get now playing info. Is nowplaying-cli installed? (brew install nowplaying-cli)"
    );
  }
}

/**
 * Strip " - TIDAL" suffix from titles that come from the window title.
 */
function cleanTitle(title: string): string {
  return title.replace(/\s*-\s*TIDAL$/i, "").trim();
}

/**
 * Format seconds as mm:ss.
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
