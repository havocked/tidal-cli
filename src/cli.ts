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

const program = new Command();

program
  .name("tidal-cli")
  .description("Control the TIDAL desktop app from the command line")
  .version("0.2.0");

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

program.parseAsync(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
