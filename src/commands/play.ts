import { Command } from "commander";
import { loadConfig, TidalCliConfig } from "../lib/config";
import { ensureTidalWithCDP } from "../services/launcher";
import { evaluate } from "../services/cdp";
import { TidalStateTracker } from "../services/state";
import { logger } from "../lib/logger";

/**
 * Parse a Tidal resource identifier. Accepts:
 * - Full URL: https://tidal.com/browse/track/251380837
 * - Full URL: https://listen.tidal.com/playlist/xxx
 * - Short: track/251380837
 * - Short: playlist/699e5b55-...
 * - "favorites" or "liked" (special: plays liked tracks)
 * - Just an ID (assumes track): 251380837
 */
export function parseTidalResource(input: string): {
  type: string;
  id: string;
  spaPath: string;
} {
  // Special: favorites/liked tracks
  if (/^(favorites|liked|collection)$/i.test(input)) {
    return { type: "favorites", id: "tracks", spaPath: "/my-collection/tracks" };
  }

  // Full tidal URL
  const urlMatch = input.match(
    /(?:https?:\/\/)?(?:listen\.|www\.)?tidal\.com\/(?:browse\/)?(track|album|playlist|mix|artist)\/([^\s?#]+)/i
  );
  if (urlMatch) {
    return {
      type: urlMatch[1]!,
      id: urlMatch[2]!,
      spaPath: `/${urlMatch[1]}/${urlMatch[2]}`,
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
      spaPath: `/${shortMatch[1]}/${shortMatch[2]}`,
    };
  }

  // Bare ID — if it looks like a UUID, assume playlist; otherwise track
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(input);
  const type = isUuid ? "playlist" : "track";
  return {
    type,
    id: input,
    spaPath: `/${type}/${input}`,
  };
}

/**
 * Navigate within the TIDAL SPA without breaking the React router.
 * Uses link clicking when possible, falls back to history.pushState + popstate.
 */
async function spaNavigate(
  config: TidalCliConfig,
  spaPath: string
): Promise<void> {
  await evaluate(
    config,
    `(() => {
      // Try to find and click a matching sidebar/page link first
      const link = document.querySelector('a[href="${spaPath}"]');
      if (link) { link.click(); return 'link'; }
      // Fallback: use history API to trigger React router
      window.history.pushState({}, '', '${spaPath}');
      window.dispatchEvent(new PopStateEvent('popstate'));
      return 'pushState';
    })()`
  );
  // Wait for the SPA to render the new page
  await new Promise((r) => setTimeout(r, 3000));
}

/**
 * Wait for track links to appear on the page (indicates content loaded).
 */
async function waitForTracks(
  config: TidalCliConfig,
  timeoutMs = 10000
): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const count = (await evaluate(
      config,
      `document.querySelectorAll('a[href*="/track/"]').length`
    )) as number;
    if (count > 0) return count;
    await new Promise((r) => setTimeout(r, 500));
  }
  return 0;
}

/**
 * Click the inline play button (16x16) for the first track in a list.
 * These are the small play buttons inside track rows that actually trigger playback.
 */
async function clickInlinePlayButton(
  config: TidalCliConfig
): Promise<boolean> {
  const result = await evaluate(
    config,
    `(() => {
      const playBtns = [...document.querySelectorAll('button[aria-label="Play"]')];
      // Inline track play buttons are 16x16, inside tidal-ui h-stack
      const inline = playBtns.filter(b => {
        const r = b.getBoundingClientRect();
        return r.width <= 20 && r.width > 0
          && b.parentElement?.className?.includes('tidal-ui');
      });
      if (inline.length > 0) { inline[0].click(); return true; }
      return false;
    })()`
  );
  return result === true;
}

/**
 * Click the hero/overlay play button (40x40) for album/playlist pages.
 */
async function clickHeroPlayButton(
  config: TidalCliConfig
): Promise<boolean> {
  const result = await evaluate(
    config,
    `(() => {
      const playBtns = [...document.querySelectorAll('button[aria-label="Play"]')];
      // Hero play button is 40x40 with overlayIconWrapper parent
      const hero = playBtns.find(b => {
        const r = b.getBoundingClientRect();
        return r.width >= 38 && r.width <= 42
          && b.parentElement?.className?.includes('overlayIconWrapper')
          && !b.parentElement?.className?.includes('Album');
      });
      if (hero) { hero.click(); return true; }
      return false;
    })()`
  );
  return result === true;
}

/**
 * Get current playback info from the TIDAL player bar via CDP.
 * More reliable than nowplaying-cli for TIDAL's native player.
 */
async function getPlayerBarInfo(
  config: TidalCliConfig
): Promise<{ isPlaying: boolean; track: string | null; artist: string | null }> {
  const result = (await evaluate(
    config,
    `(() => {
      const hasPause = !!document.querySelector('button[aria-label="Pause"]');
      // Player bar links at the bottom of the viewport
      const links = [...document.querySelectorAll('a')].filter(a => {
        const r = a.getBoundingClientRect();
        return r.top > window.innerHeight - 100 && r.top < window.innerHeight;
      });
      const trackLink = links.find(a => a.href?.includes('/track/'));
      const artistLink = links.find(a => a.href?.includes('/artist/'));
      return {
        isPlaying: hasPause,
        track: trackLink?.textContent?.trim() || null,
        artist: artistLink?.textContent?.trim() || null
      };
    })()`
  )) as { isPlaying: boolean; track: string | null; artist: string | null } | null;
  return result ?? { isPlaying: false, track: null, artist: null };
}

async function ensureShuffleEnabled(
  config: TidalCliConfig
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
    .description(
      "Play a track, album, playlist, mix, or favorites"
    )
    .argument(
      "<resource>",
      'Tidal URL, type/id, bare track ID, or "favorites"'
    )
    .option(
      "--no-shuffle",
      "Do not enable shuffle (default for albums/playlists)"
    )
    .action(async (resource: string, options: { shuffle?: boolean }) => {
      const config = loadConfig();
      const parsed = parseTidalResource(resource);
      logger.info(`play: ${parsed.type}/${parsed.id}`);

      const stateTracker = new TidalStateTracker(config);

      // Ensure TIDAL is running with CDP and fully ready
      await ensureTidalWithCDP(config);
      logger.info("Waiting for TIDAL to be ready...");
      await stateTracker.waitFor("Ready", 20000);

      // Navigate via SPA router (don't break React)
      logger.info("Navigating to resource...");
      await spaNavigate(config, parsed.spaPath);

      // Wait for tracks to appear on the page
      const trackCount = await waitForTracks(config);
      if (trackCount === 0) {
        console.error(
          "⚠ No tracks found on page. Navigation may have failed."
        );
        process.exitCode = 1;
        return;
      }
      logger.verbose("Tracks on page", { count: trackCount });

      // Click the appropriate play button
      let clicked = false;
      if (
        parsed.type === "track" ||
        parsed.type === "favorites"
      ) {
        // For single tracks and favorites: use inline play button
        clicked = await clickInlinePlayButton(config);
      } else {
        // For albums/playlists: try hero button first, fall back to inline
        clicked = await clickHeroPlayButton(config);
        if (!clicked) {
          clicked = await clickInlinePlayButton(config);
        }
      }

      if (!clicked) {
        console.error("⚠ Could not find a play button to click.");
        process.exitCode = 1;
        return;
      }

      // Enable shuffle for collections
      const shouldEnableShuffle =
        options.shuffle !== false &&
        (parsed.type === "album" ||
          parsed.type === "playlist" ||
          parsed.type === "favorites");
      if (shouldEnableShuffle) {
        try {
          const shuffleStatus = await ensureShuffleEnabled(config);
          if (shuffleStatus === "enabled") {
            console.log("🔀 Shuffle enabled");
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.warn("Failed to enable shuffle", { error: message });
        }
      }

      // Verify playback via player bar (more reliable than nowplaying-cli)
      await new Promise((r) => setTimeout(r, 2000));
      const playerInfo = await getPlayerBarInfo(config);

      if (playerInfo.isPlaying && playerInfo.track) {
        console.log(
          `♫ ${playerInfo.track} — ${playerInfo.artist ?? "Unknown"}`
        );
      } else if (playerInfo.isPlaying) {
        console.log("▶ Playing");
      } else {
        console.log(
          "⚠ Play command sent but could not confirm playback started"
        );
      }

      logger.done("play command completed", {
        type: parsed.type,
        id: parsed.id,
      });
    });
}
