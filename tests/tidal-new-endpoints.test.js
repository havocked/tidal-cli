const test = require("node:test");
const assert = require("node:assert/strict");

// Test the new service modules can be imported without errors
const collections = require("../dist/services/tidal/collections");
const recommendations = require("../dist/services/tidal/recommendations");

// ─── Collections module exports ──────────────────────────────────────────────

test("collections module exports getFavoriteAlbums", () => {
  assert.equal(typeof collections.getFavoriteAlbums, "function");
});

test("collections module exports getFavoriteArtists", () => {
  assert.equal(typeof collections.getFavoriteArtists, "function");
});

test("collections module exports getUserPlaylists", () => {
  assert.equal(typeof collections.getUserPlaylists, "function");
});

// ─── Recommendations module exports ─────────────────────────────────────────

test("recommendations module exports getDiscoveryMixes", () => {
  assert.equal(typeof recommendations.getDiscoveryMixes, "function");
});

test("recommendations module exports getMyMixes", () => {
  assert.equal(typeof recommendations.getMyMixes, "function");
});

test("recommendations module exports getNewArrivalMixes", () => {
  assert.equal(typeof recommendations.getNewArrivalMixes, "function");
});

// ─── Barrel exports include new functions ────────────────────────────────────

const tidal = require("../dist/services/tidal");

test("barrel exports getSimilarArtists", () => {
  assert.equal(typeof tidal.getSimilarArtists, "function");
});

test("barrel exports getArtistRadio", () => {
  assert.equal(typeof tidal.getArtistRadio, "function");
});

test("barrel exports getArtistBio", () => {
  assert.equal(typeof tidal.getArtistBio, "function");
});

test("barrel exports searchAlbums", () => {
  assert.equal(typeof tidal.searchAlbums, "function");
});

test("barrel exports searchPlaylists", () => {
  assert.equal(typeof tidal.searchPlaylists, "function");
});

test("barrel exports searchTopHits", () => {
  assert.equal(typeof tidal.searchTopHits, "function");
});

test("barrel exports getLyrics", () => {
  assert.equal(typeof tidal.getLyrics, "function");
});

test("barrel exports getTrackGenres", () => {
  assert.equal(typeof tidal.getTrackGenres, "function");
});

test("barrel exports deletePlaylist", () => {
  assert.equal(typeof tidal.deletePlaylist, "function");
});

test("barrel exports removeTracksFromPlaylist", () => {
  assert.equal(typeof tidal.removeTracksFromPlaylist, "function");
});

test("barrel exports getFavoriteAlbums", () => {
  assert.equal(typeof tidal.getFavoriteAlbums, "function");
});

test("barrel exports getFavoriteArtists", () => {
  assert.equal(typeof tidal.getFavoriteArtists, "function");
});

test("barrel exports getUserPlaylists", () => {
  assert.equal(typeof tidal.getUserPlaylists, "function");
});

test("barrel exports getDiscoveryMixes", () => {
  assert.equal(typeof tidal.getDiscoveryMixes, "function");
});

test("barrel exports getMyMixes", () => {
  assert.equal(typeof tidal.getMyMixes, "function");
});

test("barrel exports getNewArrivalMixes", () => {
  assert.equal(typeof tidal.getNewArrivalMixes, "function");
});

// ─── CLI command registration ────────────────────────────────────────────────

const { Command } = require("commander");

test("similar command registers correctly", () => {
  const { registerSimilarCommand } = require("../dist/commands/similar");
  const program = new Command();
  registerSimilarCommand(program);
  const cmd = program.commands.find((c) => c.name() === "similar");
  assert.ok(cmd, "similar command should be registered");
});

test("radio command registers correctly", () => {
  const { registerRadioCommand } = require("../dist/commands/radio");
  const program = new Command();
  registerRadioCommand(program);
  const cmd = program.commands.find((c) => c.name() === "radio");
  assert.ok(cmd, "radio command should be registered");
});

test("recommendations command registers correctly", () => {
  const { registerRecommendationsCommand } = require("../dist/commands/recommendations");
  const program = new Command();
  registerRecommendationsCommand(program);
  const cmd = program.commands.find((c) => c.name() === "recommendations");
  assert.ok(cmd, "recommendations command should be registered");
});

test("library command registers with subcommands", () => {
  const { registerLibraryCommand } = require("../dist/commands/library");
  const program = new Command();
  registerLibraryCommand(program);
  const lib = program.commands.find((c) => c.name() === "library");
  assert.ok(lib, "library command should be registered");
  const subNames = lib.commands.map((c) => c.name());
  assert.ok(subNames.includes("tracks"), "should have tracks subcommand");
  assert.ok(subNames.includes("albums"), "should have albums subcommand");
  assert.ok(subNames.includes("artists"), "should have artists subcommand");
  assert.ok(subNames.includes("playlists"), "should have playlists subcommand");
});

test("lyrics command registers correctly", () => {
  const { registerLyricsCommand } = require("../dist/commands/lyrics");
  const program = new Command();
  registerLyricsCommand(program);
  const cmd = program.commands.find((c) => c.name() === "lyrics");
  assert.ok(cmd, "lyrics command should be registered");
});

test("playlist command has delete and remove subcommands", () => {
  const { registerPlaylistCommand } = require("../dist/commands/playlist");
  const program = new Command();
  registerPlaylistCommand(program);
  const playlist = program.commands.find((c) => c.name() === "playlist");
  assert.ok(playlist, "playlist command should be registered");
  const subNames = playlist.commands.map((c) => c.name());
  assert.ok(subNames.includes("create"), "should have create subcommand");
  assert.ok(subNames.includes("delete"), "should have delete subcommand");
  assert.ok(subNames.includes("remove"), "should have remove subcommand");
});

test("search command accepts --type with new options", () => {
  const { registerSearchCommand } = require("../dist/commands/search");
  const program = new Command();
  registerSearchCommand(program);
  const cmd = program.commands.find((c) => c.name() === "search");
  assert.ok(cmd, "search command should be registered");
  const typeOption = cmd.options.find((o) => o.long === "--type");
  assert.ok(typeOption, "should have --type option");
});
