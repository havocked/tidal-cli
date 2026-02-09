import { Command } from "commander";
import { loadConfig } from "../lib/config";
import { ensureTidalWithCDP } from "../services/launcher";
import { clickButton, evaluate } from "../services/cdp";

/**
 * Get the current playback state from the player bar buttons.
 * If "Pause" button exists → currently playing. If "Play" exists → paused.
 */
async function getPlaybackState(
  config: ReturnType<typeof loadConfig>
): Promise<"playing" | "paused" | "stopped"> {
  const result = await evaluate(
    config,
    `(() => {
      // Player bar buttons are near the bottom — look for Pause/Play in the transport controls
      const btns = [...document.querySelectorAll('button[aria-label]')];
      const labels = btns.map(b => b.getAttribute('aria-label'));
      if (labels.includes('Pause')) return 'playing';
      // Check if there's a Previous/Next (transport exists) with Play
      if (labels.includes('Previous') || labels.includes('Next')) return 'paused';
      return 'stopped';
    })()`
  );
  return (result as "playing" | "paused" | "stopped") ?? "stopped";
}

/**
 * Click a transport button in the player bar.
 * The transport cluster is: Shuffle, Previous, Play/Pause, Next, Repeat, Volume
 * We find it by looking for the cluster where Shuffle + Previous + Next + Repeat
 * are all within ~5 indices of each other.
 */
async function clickTransportButton(
  config: ReturnType<typeof loadConfig>,
  label: string
): Promise<boolean> {
  const result = await evaluate(
    config,
    `(() => {
      const btns = [...document.querySelectorAll('button[aria-label]')];
      // Find the transport cluster: Shuffle is unique to transport bar
      const shuffleIdx = btns.findIndex(b => b.getAttribute('aria-label') === 'Shuffle');
      if (shuffleIdx === -1) return false;
      
      // Transport buttons are within ~6 indices after Shuffle
      for (let i = shuffleIdx; i < Math.min(btns.length, shuffleIdx + 7); i++) {
        if (btns[i]?.getAttribute('aria-label') === '${label}') {
          btns[i].click();
          return true;
        }
      }
      return false;
    })()`
  );
  return result === true;
}

export function registerPlaybackCommands(program: Command): void {
  program
    .command("pause")
    .description("Pause playback")
    .action(async () => {
      const config = loadConfig();
      await ensureTidalWithCDP(config);
      const clicked = await clickTransportButton(config, "Pause");
      console.log(clicked ? "⏸ Paused" : "⚠ Not currently playing");
    });

  program
    .command("resume")
    .description("Resume playback")
    .action(async () => {
      const config = loadConfig();
      await ensureTidalWithCDP(config);

      const state = await getPlaybackState(config);
      if (state === "playing") {
        console.log("▶ Already playing");
        return;
      }
      // Click the Play button in transport area
      const clicked = await clickTransportButton(config, "Play");
      console.log(clicked ? "▶ Resumed" : "⚠ Nothing to resume");
    });

  program
    .command("next")
    .description("Skip to next track")
    .action(async () => {
      const config = loadConfig();
      await ensureTidalWithCDP(config);
      const clicked = await clickTransportButton(config, "Next");
      console.log(clicked ? "⏭ Next" : "⚠ No next button found");
    });

  program
    .command("prev")
    .description("Go to previous track")
    .action(async () => {
      const config = loadConfig();
      await ensureTidalWithCDP(config);
      const clicked = await clickTransportButton(config, "Previous");
      console.log(clicked ? "⏮ Previous" : "⚠ No previous button found");
    });

  program
    .command("shuffle")
    .description("Toggle shuffle mode")
    .action(async () => {
      const config = loadConfig();
      await ensureTidalWithCDP(config);
      const clicked = await clickTransportButton(config, "Shuffle");
      console.log(clicked ? "🔀 Shuffle toggled" : "⚠ No shuffle button found");
    });

  program
    .command("repeat")
    .description("Toggle repeat mode")
    .action(async () => {
      const config = loadConfig();
      await ensureTidalWithCDP(config);
      const clicked = await clickTransportButton(config, "Repeat");
      console.log(clicked ? "🔁 Repeat toggled" : "⚠ No repeat button found");
    });
}
