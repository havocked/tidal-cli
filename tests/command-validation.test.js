const test = require("node:test");
const assert = require("node:assert/strict");
const { Command } = require("commander");

test("similar command rejects non-numeric artist-id", async () => {
  const { registerSimilarCommand } = require("../dist/commands/similar");
  const program = new Command();
  registerSimilarCommand(program);

  const previousExitCode = process.exitCode;
  process.exitCode = 0;

  try {
    await program.parseAsync(["node", "tidal-cli", "similar", "not-a-number"]);
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test("radio --artist rejects non-numeric id", async () => {
  const { registerRadioCommand } = require("../dist/commands/radio");
  const program = new Command();
  registerRadioCommand(program);

  const previousExitCode = process.exitCode;
  process.exitCode = 0;

  try {
    await program.parseAsync(["node", "tidal-cli", "radio", "not-a-number", "--artist"]);
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = previousExitCode;
  }
});
