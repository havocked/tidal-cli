const test = require("node:test");
const assert = require("node:assert/strict");
const { withRetry } = require("../dist/lib/retry");

function makeResponse(status, retryAfter = null) {
  return {
    status,
    headers: {
      get(name) {
        if (String(name).toLowerCase() === "retry-after") return retryAfter;
        return null;
      },
    },
  };
}

test("withRetry returns successful response without retries", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    return { data: { ok: true }, response: makeResponse(200) };
  });

  assert.equal(calls, 1);
  assert.deepEqual(result.data, { ok: true });
});

test("withRetry retries on 429 and succeeds", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls += 1;
      if (calls < 3) {
        return { error: { message: "rate limited" }, response: makeResponse(429, "0") };
      }
      return { data: { ok: true }, response: makeResponse(200) };
    },
    { label: "retry-test", maxRetries: 3 }
  );

  assert.equal(calls, 3);
  assert.deepEqual(result.data, { ok: true });
});

test("withRetry throws non-429 API errors", async () => {
  await assert.rejects(
    () =>
      withRetry(
        async () => ({
          error: { errors: [{ detail: "Unauthorized" }] },
          response: makeResponse(401),
        }),
        { label: "searchArtists" }
      ),
    /searchArtists failed \(401\): Unauthorized/
  );
});

test("withRetry throws when 429 persists after max retries", async () => {
  await assert.rejects(
    () =>
      withRetry(
        async () => ({
          error: { errors: [{ detail: "Rate limit exceeded" }] },
          response: makeResponse(429, "0"),
        }),
        { label: "getFavoriteTracks", maxRetries: 1 }
      ),
    /getFavoriteTracks failed \(429\): Rate limit exceeded/
  );
});
