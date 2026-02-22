import { Command } from "commander";
import { loadConfig } from "../lib/config";
import { ensureTidalWithCDP } from "../services/launcher";
import { navigate, clickButton, evaluate } from "../services/cdp";
import { logger } from "../lib/logger";

/**
 * Parse a Tidal resource identifier. Accepts:
 * - Full URL: https://tidal.com/browse/track/251380837
 * - Full URL: https://listen.tidal.com/playlist/xxx
 * - Short: track/251380837
 * - Short: playlist/699e5b55-...
 * - Just an ID (assumes track): 251380837
 */
export function parseTidalResource(input: string): {
  type: string;
  id: string;
  desktopUrl: string;
} {
  // Full tidal URL
  const urlMatch = input.match(
    /(?:https?:\/\/)?(?:listen\.|www\.)?tidal\.com\/(?:browse\/)?(track|album|playlist|mix|artist)\/([^\s?#]+)/i
  );
  if (urlMatch) {
    return {
      type: urlMatch[1]!,
      id: urlMatch[2]!,
      desktopUrl: `https://desktop.tidal.com/${urlMatch[1]}/${urlMatch[2]}`,
    };
  }

  // Short form: type/id
  const shortMatch = input.match(
    /^(track|album|playlist|mix|artist)\/([^\s]+)$/i
  );
  if (shortMatch) {
    return {
      type: shortMatch[1]!,
      id: shortMatch[2]!,
      desktopUrl: `https://desktop.tidal.com/${shortMatch[1]}/${shortMatch[2]}`,
    };
  }

  // Bare ID — if it looks like a UUID, assume playlist; otherwise track
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(input);
  const type = isUuid ? "playlist" : "track";
  return {
    type,
    id: input,
    desktopUrl: `https://desktop.tidal.com/${type}/${input}`,
  };
}

async function ensureShuffleEnabled(
  config: ReturnType<typeof loadConfig>
): Promise<"enabled" | "already_on" | "missing"> {
  const result = await evaluate(
    config,
    `(() => {
      const btns = [...document.querySelectorAll('button[aria-label]')];
      const btn = btns.find((b) => b.getAttribute('aria-label') === 'Shuffle');
      if (!btn) return 'missing';

      const ariaPressed = btn.getAttribute('aria-pressed');
      const ariaChecked = btn.getAttribute('aria-checked');
      const dataState = btn.getAttribute('data-state');
      const className = typeof btn.className === 'string' ? btn.className.toLowerCase() : '';
      const isActive =
        ariaPressed === 'true' ||
        ariaChecked === 'true' ||
        dataState === 'on' ||
        className.includes('active') ||
        className.includes('selected');

      if (isActive) return 'already_on';
      btn.click();
      return 'enabled';
    })()`
  );

  if (result === "enabled" || result === "already_on" || result === "missing") {
    return result;
  }
  return "missing";
}

export function registerPlayCommand(program: Command): void {
  program
    .command("play")
    .description("Play a track, album, playlist, or mix")
    .argument("<resource>", "Tidal URL, type/id, or bare track ID")
    .option("--no-shuffle", "Do not enable shuffle (default for albums/playlists)")
    .action(async (resource: string, options: { shuffle?: boolean }) => {
      const config = loadConfig();
      const parsed = parseTidalResource(resource);
      logger.info(`play: ${parsed.type}/${parsed.id}`);
      logger.verbose("Parsed resource", { type: parsed.type, id: parsed.id, url: parsed.desktopUrl });

      await ensureTidalWithCDP(config);
      console.log(`▶ Playing ${parsed.type}/${parsed.id}`);

      // Navigate to the resource page
      await navigate(config, parsed.desktopUrl);

      // Wait a bit more for content to load, then click the main Play button
      await new Promise((r) => setTimeout(r, 1000));

      // The first Play button with _playButton class is the main "play all" button
      const clicked = await clickButton(config, "Play", { index: 0 });
      if (!clicked) {
        // Fallback: try clicking any play button
        const fallback = await evaluate(
          config,
          `(() => {
            const btn = document.querySelector('button[aria-label="Play"]');
            if (btn) { btn.click(); return true; }
            return false;
          })()`
        );
        if (!fallback) {
          console.error("⚠ Could not find play button. Page may still be loading.");
          process.exitCode = 1;
          return;
        }
      }

      const shouldEnableShuffle =
        options.shuffle !== false &&
        (parsed.type === "album" || parsed.type === "playlist");
      if (shouldEnableShuffle) {
        try {
          const shuffleStatus = await ensureShuffleEnabled(config);
          if (shuffleStatus === "enabled") {
            console.log("🔀 Shuffle enabled");
          } else if (shuffleStatus === "missing") {
            logger.warn("Could not find shuffle button to enable shuffle");
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.warn("Failed to enable shuffle", { error: message });
        }
      }

      // Brief pause then report what's playing
      await new Promise((r) => setTimeout(r, 2000));

      try {
        const { getNowPlaying, formatTime } = await import("../services/nowplaying");
        const np = getNowPlaying();
        if (np.isPlaying) {
          console.log(`♫ ${np.title} — ${np.artist}`);
          if (np.duration > 0) {
            console.log(`  ${formatTime(np.elapsed)} / ${formatTime(np.duration)}`);
          }
        } else {
          console.log("⏸ Playback started but may be buffering...");
        }
      } catch {
        console.log("✓ Play command sent");
      }
      logger.done("play command completed", { type: parsed.type, id: parsed.id });
    });
}
