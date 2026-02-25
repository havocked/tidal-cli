const test = require("node:test");
const assert = require("node:assert/strict");
const { TidalStateTracker } = require("../dist/services/state");

/**
 * Helper: create a TidalStateTracker with mock probes.
 */
function createTracker(probeOverrides = {}) {
  const defaults = {
    isProcessRunning: async () => false,
    isCDPAvailable: async () => false,
    isMainPageLoaded: async () => false,
    getPlaybackState: async () => "stopped",
  };
  const probes = { ...defaults, ...probeOverrides };
  return new TidalStateTracker({ cdpPort: 9222 }, probes);
}

// =============================================================
// getState() — all state combinations
// =============================================================

test("getState: returns Dead when process is not running", async () => {
  const tracker = createTracker({ isProcessRunning: async () => false });
  assert.equal(await tracker.getState(), "Dead");
});

test("getState: returns Launching when process running but no CDP", async () => {
  const tracker = createTracker({
    isProcessRunning: async () => true,
    isCDPAvailable: async () => false,
  });
  assert.equal(await tracker.getState(), "Launching");
});

test("getState: returns Connecting when CDP available but main page not loaded", async () => {
  const tracker = createTracker({
    isProcessRunning: async () => true,
    isCDPAvailable: async () => true,
    isMainPageLoaded: async () => false,
  });
  assert.equal(await tracker.getState(), "Connecting");
});

test("getState: returns Ready when everything up but not playing", async () => {
  const tracker = createTracker({
    isProcessRunning: async () => true,
    isCDPAvailable: async () => true,
    isMainPageLoaded: async () => true,
    getPlaybackState: async () => "stopped",
  });
  assert.equal(await tracker.getState(), "Ready");
});

test("getState: returns Playing when track is actively playing", async () => {
  const tracker = createTracker({
    isProcessRunning: async () => true,
    isCDPAvailable: async () => true,
    isMainPageLoaded: async () => true,
    getPlaybackState: async () => "playing",
  });
  assert.equal(await tracker.getState(), "Playing");
});

test("getState: returns Paused when track is paused", async () => {
  const tracker = createTracker({
    isProcessRunning: async () => true,
    isCDPAvailable: async () => true,
    isMainPageLoaded: async () => true,
    getPlaybackState: async () => "paused",
  });
  assert.equal(await tracker.getState(), "Paused");
});

// =============================================================
// getState() — short-circuit behavior (cheapest probes first)
// =============================================================

test("getState: does not check CDP if process is not running", async () => {
  let cdpCalled = false;
  const tracker = createTracker({
    isProcessRunning: async () => false,
    isCDPAvailable: async () => { cdpCalled = true; return false; },
  });
  await tracker.getState();
  assert.equal(cdpCalled, false, "should not check CDP when process is dead");
});

test("getState: does not check main page if CDP is not available", async () => {
  let mainPageCalled = false;
  const tracker = createTracker({
    isProcessRunning: async () => true,
    isCDPAvailable: async () => false,
    isMainPageLoaded: async () => { mainPageCalled = true; return false; },
  });
  await tracker.getState();
  assert.equal(mainPageCalled, false, "should not check main page when CDP is down");
});

test("getState: does not check playback if main page is not loaded", async () => {
  let playbackCalled = false;
  const tracker = createTracker({
    isProcessRunning: async () => true,
    isCDPAvailable: async () => true,
    isMainPageLoaded: async () => false,
    getPlaybackState: async () => { playbackCalled = true; return "stopped"; },
  });
  await tracker.getState();
  assert.equal(playbackCalled, false, "should not check playback when main page not loaded");
});

// =============================================================
// waitFor() — state transitions
// =============================================================

test("waitFor: resolves immediately if already at target state", async () => {
  const tracker = createTracker({
    isProcessRunning: async () => true,
    isCDPAvailable: async () => true,
    isMainPageLoaded: async () => true,
    getPlaybackState: async () => "stopped",
  });
  const result = await tracker.waitFor("Ready", 1000);
  assert.equal(result, "Ready");
});

test("waitFor: resolves if state exceeds target (Playing > Ready)", async () => {
  const tracker = createTracker({
    isProcessRunning: async () => true,
    isCDPAvailable: async () => true,
    isMainPageLoaded: async () => true,
    getPlaybackState: async () => "playing",
  });
  const result = await tracker.waitFor("Ready", 1000);
  assert.equal(result, "Playing");
});

test("waitFor: Paused satisfies waitFor Ready", async () => {
  const tracker = createTracker({
    isProcessRunning: async () => true,
    isCDPAvailable: async () => true,
    isMainPageLoaded: async () => true,
    getPlaybackState: async () => "paused",
  });
  const result = await tracker.waitFor("Ready", 1000);
  assert.equal(result, "Paused");
});

test("waitFor: transitions from Dead to Ready over time", async () => {
  let callCount = 0;
  const tracker = createTracker({
    isProcessRunning: async () => {
      callCount++;
      return callCount >= 2; // process starts on 2nd poll
    },
    isCDPAvailable: async () => callCount >= 3,
    isMainPageLoaded: async () => callCount >= 4,
    getPlaybackState: async () => "stopped",
  });
  const result = await tracker.waitFor("Ready", 5000, 50);
  assert.equal(result, "Ready");
  assert.ok(callCount >= 4, `expected at least 4 polls, got ${callCount}`);
});

test("waitFor: transitions from Dead to Playing over time", async () => {
  let callCount = 0;
  const tracker = createTracker({
    isProcessRunning: async () => {
      callCount++;
      return callCount >= 2;
    },
    isCDPAvailable: async () => callCount >= 3,
    isMainPageLoaded: async () => callCount >= 4,
    getPlaybackState: async () => (callCount >= 5 ? "playing" : "stopped"),
  });
  const result = await tracker.waitFor("Playing", 5000, 50);
  assert.equal(result, "Playing");
});

test("waitFor: times out if target state never reached", async () => {
  const tracker = createTracker({
    isProcessRunning: async () => true,
    isCDPAvailable: async () => false, // stuck at Launching forever
  });
  await assert.rejects(
    () => tracker.waitFor("Ready", 300, 50),
    (err) => {
      assert.ok(err.message.includes('Timed out'));
      assert.ok(err.message.includes('"Ready"'));
      assert.ok(err.message.includes('"Launching"'));
      return true;
    }
  );
});

test("waitFor: times out if stuck at Dead", async () => {
  const tracker = createTracker({
    isProcessRunning: async () => false,
  });
  await assert.rejects(
    () => tracker.waitFor("Launching", 200, 50),
    (err) => {
      assert.ok(err.message.includes('"Dead"'));
      return true;
    }
  );
});

test("waitFor Dead: always resolves immediately (everything is at least Dead)", async () => {
  const tracker = createTracker({ isProcessRunning: async () => false });
  const result = await tracker.waitFor("Dead", 100);
  assert.equal(result, "Dead");
});

// =============================================================
// Edge cases
// =============================================================

test("getState: CDP port is configurable", async () => {
  let portUsed = 0;
  const tracker = new TidalStateTracker({ cdpPort: 5555 }, {
    isProcessRunning: async () => true,
    isCDPAvailable: async (port) => { portUsed = port; return false; },
    isMainPageLoaded: async () => false,
    getPlaybackState: async () => "stopped",
  });
  await tracker.getState();
  assert.equal(portUsed, 5555);
});

test("waitFor: custom poll interval is respected", async () => {
  let polls = 0;
  const tracker = createTracker({
    isProcessRunning: async () => { polls++; return false; },
  });

  const start = Date.now();
  try {
    await tracker.waitFor("Ready", 250, 100);
  } catch {
    // expected timeout
  }
  const elapsed = Date.now() - start;

  // With 100ms interval and 250ms timeout, expect 2-4 polls
  assert.ok(polls >= 2 && polls <= 5, `expected 2-5 polls, got ${polls} in ${elapsed}ms`);
});
