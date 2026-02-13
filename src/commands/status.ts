import { Command } from "commander";
import { getNowPlaying, formatTime } from "../services/nowplaying";
import { plainKV } from "../lib/formatter";
import { logger } from "../lib/logger";

async function showAuthHint(): Promise<void> {
  try {
    const { loadCredentials, initTidalClient, getCurrentUser } = await import("../services/tidal");
    const { installNodeStorage } = await import("../services/nodeStorage");
    installNodeStorage();
    loadCredentials();
    await initTidalClient();
    const user = await getCurrentUser();
    console.log(`  Auth:   ✅ ${user.username || user.email || "logged in"}`);
  } catch {
    console.log("  Auth:   ❌ Not logged in (run: tidal-cli login)");
  }
}

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .alias("now")
    .description("Show current playback status")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        logger.info("status: checking now playing");
        const plain = program.opts().plain;
        const np = getNowPlaying();

        if (opts.json) {
          console.log(JSON.stringify(np, null, 2));
          return;
        }

        if (!np.title || np.title === "") {
          console.log("Nothing playing");
          await showAuthHint();
          return;
        }

        if (plain) {
          console.log(plainKV({
            state: np.isPlaying ? "playing" : "paused",
            title: np.title,
            artist: np.artist,
            album: np.album,
            elapsed: np.elapsed,
            duration: np.duration,
          }));
          return;
        }

        const icon = np.isPlaying ? "▶" : "⏸";
        console.log(`${icon} ${np.title}`);
        if (np.artist) console.log(`  Artist: ${np.artist}`);
        if (np.album) console.log(`  Album:  ${np.album}`);
        if (np.duration > 0) {
          console.log(
            `  Time:   ${formatTime(np.elapsed)} / ${formatTime(np.duration)}`
          );
        }
        logger.done("status completed", { title: np.title, isPlaying: np.isPlaying });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("status failed", { error: msg });
        console.error(msg);
        process.exitCode = 1;
      }
    });
}
