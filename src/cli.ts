#!/usr/bin/env node

import { Command } from "commander";
import { registerPlayCommand } from "./commands/play";
import { registerPlaybackCommands } from "./commands/playback";
import { registerStatusCommand } from "./commands/status";
import { registerVolumeCommand } from "./commands/volume";
import { registerAuthCommand } from "./commands/auth";
import { registerSearchCommand } from "./commands/search";
import { registerPlaylistCommand } from "./commands/playlist";
import { registerSyncCommand } from "./commands/sync";
import { registerSimilarCommand } from "./commands/similar";
import { registerRadioCommand } from "./commands/radio";
import { registerRecommendationsCommand } from "./commands/recommendations";
import { registerLibraryCommand } from "./commands/library";
import { registerLyricsCommand } from "./commands/lyrics";
import { registerArtistCommand } from "./commands/artist";
import { registerAlbumCommand } from "./commands/album";
import { registerSuggestCommand } from "./commands/suggest";
import { logger } from "./lib/logger";

const program = new Command();

program
  .name("tidal-cli")
  .description("Control the TIDAL desktop app from the command line")
  .version("0.3.0")
  .option("--plain", "Line-oriented plain output (tab-separated, grep-friendly)")
  .option("--verbose", "Verbose logging (CDP details, API URLs)")
  .option("--debug", "Debug logging (full payloads, raw messages)")
  .option("--log-file <path>", "Write logs to file (JSON-lines format)");

// Initialize logger from global flags before any command runs
program.hook("preAction", () => {
  const opts = program.opts();
  if (opts.verbose && opts.debug) {
    console.error("Error: --verbose and --debug are mutually exclusive");
    process.exit(1);
  }
  logger.init({ verbose: opts.verbose, debug: opts.debug, logFile: opts.logFile });
  logger.startTimer();
});

// CDP playback commands
registerPlayCommand(program);
registerPlaybackCommands(program);
registerStatusCommand(program);
registerVolumeCommand(program);

// TIDAL API commands
registerAuthCommand(program);
registerSearchCommand(program);
registerPlaylistCommand(program);
registerSyncCommand(program);
registerSimilarCommand(program);
registerRadioCommand(program);
registerRecommendationsCommand(program);
registerLibraryCommand(program);
registerLyricsCommand(program);
registerArtistCommand(program);
registerAlbumCommand(program);
registerSuggestCommand(program);

// Top-level aliases for common subcommands
program
  .command("login")
  .description("Log in with your TIDAL account (alias for auth login)")
  .action(async () => {
    await program.parseAsync(["node", "tidal-cli", "auth", "login"]);
  });

program
  .command("logout")
  .description("Clear stored credentials (alias for auth logout)")
  .action(async () => {
    await program.parseAsync(["node", "tidal-cli", "auth", "logout"]);
  });

program.parseAsync(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
