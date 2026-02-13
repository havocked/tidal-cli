import { Command } from "commander";
import { getNowPlaying, formatTime } from "../services/nowplaying";
import { plainKV } from "../lib/formatter";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .alias("now")
    .description("Show current playback status")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const plain = program.opts().plain;
        const np = getNowPlaying();

        if (opts.json) {
          console.log(JSON.stringify(np, null, 2));
          return;
        }

        if (!np.title || np.title === "") {
          console.log("Nothing playing");
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
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(msg);
        process.exitCode = 1;
      }
    });
}
