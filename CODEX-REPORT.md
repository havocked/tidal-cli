# tidal-cli — Bug Report & Improvement Plan

Generated: 2026-02-22 from live testing on Mac Mini (Ori-Home).
All 99 tests pass. These are runtime issues found during real usage.

---

## 🔴 Bugs (Breaking)

### 1. `library tracks` crashes — batch size exceeds API limit

**Command:** `tidal library tracks`
**Error:** `fetchTracks(50 ids) failed (400): Filter value shouldn't have more than 20 elements`

**Root cause:** The code sends all favorite track IDs in a single API call. TIDAL's `/tracks` endpoint has a hard limit of 20 IDs per request.

**Fix:** Chunk the ID array into batches of 20, fetch in parallel (or sequential to respect rate limits), then merge results.

**File:** `src/services/tidal/collections.ts` (likely `getFavoriteTracks`)
**Related:** Check if `BATCH_SIZE` constant in the codebase is being used — tests confirm it exists and is within API limits, but it's not being applied to this fetch.

---

## 🟡 Bugs (Non-Breaking)

### 2. `recommendations` returns "Unknown" titles for all mixes

**Command:** `tidal recommendations`
**Output:** All discovery mixes, my mixes, and new arrival mixes have `"title": "Unknown"` and empty subtitles.

**Root cause:** The mix title/subtitle fields are likely at a different path in the TIDAL API response than what the mapper expects. The mix IDs come through correctly.

**File:** `src/services/tidal/recommendations.ts` and related mapper
**Debug step:** Log the raw API response for a mix to see actual field names (could be `mixName`, `name`, or nested under `attributes`).

### 3. `status` shows nothing playing immediately after `play`

**Command:** `tidal play <id>` → `tidal status`
**Output:** Status shows empty title/artist/album even though playback was just triggered.

**Likely cause:** `nowplaying-cli` reads macOS Now Playing framework, which has a delay after TIDAL starts buffering. The `play` command itself confirms `"Playback started but may be buffering..."`.

**Possible fixes:**
- Add a `--wait` flag to `play` that polls status until track metadata appears (timeout after ~5s)
- Add a `--wait` flag to `status` that retries for N seconds if empty
- Document the buffering delay as expected behavior

### 4. `lyrics` returns "not found" for popular tracks

**Command:** `tidal lyrics 58990516` (Karma Police — Radiohead)
**Output:** `No lyrics found for this track.`

**Investigation needed:** Is this a TIDAL API limitation (not all tracks have lyrics)? Or is the endpoint/auth wrong? Try a few known tracks with lyrics on TIDAL's web player to compare.

---

## 🟠 Improvements

### 5. Search relevance — popularity overrides text match

**Example:** Searching `"Bonobo Kerala"` returns Bonobo - Kong first, Kerala second. Searching `"Kiasmos Blurred"` returns the actual track at position 5.

**Current behavior:** Results appear sorted by popularity score, ignoring how well the query matches the title.

**Options:**
- A) Client-side re-ranking: score results by `(popularity * 0.3) + (titleMatch * 0.7)` using fuzzy string matching on title + artist
- B) Two-step search: first search artist, then filter/search within that artist's catalog
- C) If TIDAL API supports a `relevance` sort parameter, use it

**File:** `src/services/tidal/search.ts`

### 6. Error messages could be more actionable

**Example:** The `library tracks` error shows the raw API message. Would be better as:
```
Error: Too many tracks to fetch at once (50 > 20 limit). This is a known issue — see https://github.com/havocked/tidal-cli/issues/XX
```

**General improvement:** Wrap API errors with user-friendly messages and suggested actions.

---

## 📊 Test Coverage Gaps

Based on the 99 passing tests, these areas lack test coverage:

1. **`library tracks` batching** — no test for chunking behavior (because it doesn't exist yet)
2. **Recommendations parsing** — no test for mix title/subtitle extraction
3. **Search result ordering** — no test asserting relevance quality
4. **Lyrics** — no test for successful lyric retrieval
5. **Play + status integration** — no test simulating the buffering delay behavior

---

## Suggested Priority Order

1. **Fix `library tracks` batching** (🔴 breaking, straightforward fix)
2. **Fix `recommendations` title parsing** (🟡 bad UX, likely a simple field mapping)
3. **Improve search relevance** (🟠 impacts daily usage significantly)
4. **Investigate lyrics** (🟡 may be API limitation, low effort to check)
5. **Play buffering UX** (🟡 nice-to-have, document or add `--wait`)

---

## How to Reproduce

```bash
# 1. library tracks crash
tidal library tracks

# 2. recommendations unknown titles
tidal recommendations

# 3. status after play
tidal play 103386932 && sleep 2 && tidal status

# 4. lyrics not found
tidal lyrics 58990516

# 5. search relevance
tidal search "Kiasmos Blurred" --type track
# Expected: Kiasmos - Blurred at position 1
# Actual: position 5
```

## Environment

- **tidal-cli:** v0.3.0
- **Node:** v25.6.1
- **OS:** macOS 15.3 (arm64, Mac Mini M4)
- **TIDAL app:** Running with CDP on debug port
- **Tests:** 99/99 passing
