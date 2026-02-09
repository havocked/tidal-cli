import { Command } from "commander";
import { getNowPlaying, formatTime } from "../services/nowplaying";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .alias("now")
    .description("Show current playback status")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const np = getNowPlaying();

        if (opts.json) {
          console.log(JSON.stringify(np, null, 2));
          return;
        }

        if (!np.title || np.title === "") {
          console.log("Nothing playing");
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
