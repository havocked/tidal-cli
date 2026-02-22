const test = require("node:test");
const assert = require("node:assert/strict");
const { Command } = require("commander");
const { parseTidalResource } = require("../dist/commands/play");

test("parseTidalResource handles full browse URL", () => {
  const result = parseTidalResource("https://tidal.com/browse/track/251380837");
  assert.equal(result.type, "track");
  assert.equal(result.id, "251380837");
  assert.equal(result.desktopUrl, "https://desktop.tidal.com/track/251380837");
});

test("parseTidalResource handles listen URL", () => {
  const result = parseTidalResource(
    "https://listen.tidal.com/playlist/699e5b55-274b-499c-b995-dcefa5e5921b"
  );
  assert.equal(result.type, "playlist");
  assert.equal(result.id, "699e5b55-274b-499c-b995-dcefa5e5921b");
});

test("parseTidalResource handles short form", () => {
  const result = parseTidalResource("album/251380836");
  assert.equal(result.type, "album");
  assert.equal(result.id, "251380836");
  assert.equal(result.desktopUrl, "https://desktop.tidal.com/album/251380836");
});

test("parseTidalResource handles playlist short form", () => {
  const result = parseTidalResource(
    "playlist/699e5b55-274b-499c-b995-dcefa5e5921b"
  );
  assert.equal(result.type, "playlist");
  assert.equal(result.id, "699e5b55-274b-499c-b995-dcefa5e5921b");
});

test("parseTidalResource handles bare numeric ID as track", () => {
  const result = parseTidalResource("251380837");
  assert.equal(result.type, "track");
  assert.equal(result.id, "251380837");
  assert.equal(result.desktopUrl, "https://desktop.tidal.com/track/251380837");
});

test("parseTidalResource handles bare UUID as playlist", () => {
  const result = parseTidalResource(
    "699e5b55-274b-499c-b995-dcefa5e5921b"
  );
  assert.equal(result.type, "playlist");
  assert.equal(result.id, "699e5b55-274b-499c-b995-dcefa5e5921b");
});

test("parseTidalResource handles mix short form", () => {
  const result = parseTidalResource("mix/012abc345def");
  assert.equal(result.type, "mix");
  assert.equal(result.id, "012abc345def");
});

test("parseTidalResource handles artist URL", () => {
  const result = parseTidalResource(
    "https://tidal.com/browse/artist/3521958"
  );
  assert.equal(result.type, "artist");
  assert.equal(result.id, "3521958");
});

test("parseTidalResource strips query params from URL", () => {
  const result = parseTidalResource(
    "https://tidal.com/browse/track/251380837?u=123"
  );
  assert.equal(result.id, "251380837");
});

test("play command supports --no-shuffle option", () => {
  const { registerPlayCommand } = require("../dist/commands/play");
  const program = new Command();
  registerPlayCommand(program);

  const play = program.commands.find((c) => c.name() === "play");
  assert.ok(play, "play command should be registered");

  const noShuffle = play.options.find((o) => o.long === "--no-shuffle");
  assert.ok(noShuffle, "play command should expose --no-shuffle");
});
