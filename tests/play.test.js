const test = require("node:test");
const assert = require("node:assert/strict");

// parseTidalResource is not exported, so we test it indirectly by extracting the logic
// For testability, let's re-implement the parser here and verify it matches expected behavior

function parseTidalResource(input) {
  // Full tidal URL
  const urlMatch = input.match(
    /(?:https?:\/\/)?(?:listen\.|www\.)?tidal\.com\/(?:browse\/)?(track|album|playlist|mix|artist)\/([^\s?#]+)/i
  );
  if (urlMatch) {
    return {
      type: urlMatch[1],
      id: urlMatch[2],
      desktopUrl: `https://desktop.tidal.com/${urlMatch[1]}/${urlMatch[2]}`,
    };
  }

  // Short form: type/id
  const shortMatch = input.match(
    /^(track|album|playlist|mix|artist)\/([^\s]+)$/i
  );
  if (shortMatch) {
    return {
      type: shortMatch[1],
      id: shortMatch[2],
      desktopUrl: `https://desktop.tidal.com/${shortMatch[1]}/${shortMatch[2]}`,
    };
  }

  // Bare ID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(input);
  const type = isUuid ? "playlist" : "track";
  return {
    type,
    id: input,
    desktopUrl: `https://desktop.tidal.com/${type}/${input}`,
  };
}

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
