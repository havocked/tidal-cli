const test = require("node:test");
const assert = require("node:assert/strict");
const { formatTime } = require("../dist/services/nowplaying");

test("formatTime formats seconds as mm:ss", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(5), "0:05");
  assert.equal(formatTime(60), "1:00");
  assert.equal(formatTime(125), "2:05");
  assert.equal(formatTime(3661), "61:01");
});

test("formatTime handles fractional seconds", () => {
  assert.equal(formatTime(90.7), "1:30");
  assert.equal(formatTime(0.5), "0:00");
});
