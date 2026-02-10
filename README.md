# tidal-cli

A command-line interface for [TIDAL](https://tidal.com) that combines **desktop app control** (via Chrome DevTools Protocol) with **catalog access** (via the official TIDAL API).

## Two modes, one CLI

| Mode | What it does | Auth needed? |
|------|-------------|--------------|
| **CDP (playback)** | Control the running TIDAL desktop app — play, pause, skip, volume | No (piggybacks on logged-in app) |
| **API (catalog)** | Search, create playlists, sync favorites | Yes (OAuth via `auth login`) |

## Install

```bash
# Prerequisites
brew install nowplaying-cli   # Required for `status` command

# Clone and build
git clone https://github.com/havocked/tidal-cli.git
cd tidal-cli
npm install
npm run build
npm link   # makes `tidal-cli` available globally
```

## Quick start

```bash
# Play a playlist (CDP — controls desktop app)
tidal-cli play playlist/699e5b55-274b-499c-b995-dcefa5e5921b

# Check what's playing
tidal-cli status

# Search the catalog (API — requires auth)
tidal-cli auth login
tidal-cli search "Bonobo" --type artists

# Create a playlist from track IDs
echo "251380837\n12345678" | tidal-cli playlist create --name "My Mix"
```

## CDP commands (desktop app control)

These commands talk to the TIDAL Electron app via Chrome DevTools Protocol. The CLI auto-launches TIDAL with the debug port if needed.

### `play` — Play content

```bash
tidal-cli play <resource>
```

Accepts multiple formats:

| Format | Example |
|--------|---------|
| Full URL | `https://tidal.com/browse/track/251380837` |
| Listen URL | `https://listen.tidal.com/playlist/xxx` |
| Short | `track/251380837`, `playlist/xxx`, `album/xxx` |
| Bare ID (→ track) | `251380837` |
| Bare UUID (→ playlist) | `699e5b55-274b-499c-b995-dcefa5e5921b` |

### Playback control

```bash
tidal-cli pause
tidal-cli resume
tidal-cli next
tidal-cli prev
tidal-cli shuffle    # Toggle shuffle
tidal-cli repeat     # Toggle repeat
```

### `status` — Now playing

```bash
tidal-cli status          # Human-readable
tidal-cli status --json   # Machine-readable
```

Uses macOS Now Playing info via `nowplaying-cli`.

### `volume` — Get or set volume

```bash
tidal-cli volume       # Show current level
tidal-cli volume 80    # Set to 80%
```

## API commands (TIDAL catalog)

These commands use the [official TIDAL API](https://developer.tidal.com). Requires OAuth authentication.

### `auth` — Authentication

```bash
tidal-cli auth login    # Opens browser for TIDAL login (PKCE flow)
tidal-cli auth status   # Check session info
tidal-cli auth logout   # Clear stored credentials
```

**Setup:** Create a credentials file with your TIDAL developer app's client ID and secret:

```bash
mkdir -p ~/.config/tidal-cli
cat > ~/.config/tidal-cli/credentials.json << 'EOF'
{ "clientId": "YOUR_CLIENT_ID", "clientSecret": "YOUR_CLIENT_SECRET" }
EOF
```

Register at [developer.tidal.com](https://developer.tidal.com) to get credentials.

### `search` — Search the catalog

```bash
tidal-cli search "Daft Punk"                    # Search tracks (default)
tidal-cli search "Daft Punk" --type artists      # Search artists
tidal-cli search "Random Access" --limit 5       # Limit results
```

### `playlist create` — Create a playlist

Reads track IDs from stdin (one per line or comma-separated):

```bash
echo "251380837" | tidal-cli playlist create --name "Quick Mix"

# Pipe from another tool
some-tool --format ids | tidal-cli playlist create --name "Generated" --description "Auto-curated"
```

Options: `--name` (required), `--description`, `--public`

### `sync` — Fetch favorite tracks

```bash
tidal-cli sync                    # JSON output
tidal-cli sync --format ids       # Track IDs only (one per line)
tidal-cli sync --limit 100        # Limit count
```

## How CDP works

```
┌─────────┐     CDP/WebSocket      ┌──────────────┐
│ tidal-cli│ ──────────────────────▶│ TIDAL Electron│
│ (Node.js)│◀────────────────────── │ (Renderer)    │
└─────────┘  JS eval + DOM clicks  └──────────────┘
                                           │
                                    macOS NowPlaying
                                           │
                                    ┌──────────────┐
                                    │nowplaying-cli │ ◀── tidal-cli status
                                    └──────────────┘
```

1. TIDAL launches with `--remote-debugging-port=9222`
2. `tidal-cli` connects via WebSocket to evaluate JavaScript in the renderer
3. Navigation: sets `window.location.href` to desktop URLs
4. Playback: clicks transport buttons via DOM
5. Status: reads macOS Now Playing info via `nowplaying-cli`

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TIDAL_CDP_PORT` | `9222` | CDP WebSocket port |
| `TIDAL_APP_PATH` | `/Applications/TIDAL.app` | Path to TIDAL app |

### Files

| File | Purpose |
|------|---------|
| `~/.config/tidal-cli/credentials.json` | OAuth client ID + secret (you create this) |
| `~/.config/tidal-cli/auth-storage.json` | SDK tokens (auto-managed after `auth login`) |

## Pipe-friendly

stdout is reserved for machine output (JSON, IDs). Progress and diagnostics go to stderr.

```bash
# Compose with other tools
tidal-cli sync --format ids | head -20
tidal-cli search "ambient" --limit 10 | jq '.tracks[].id'
```

## Requirements

- macOS (uses macOS-specific `nowplaying-cli` and app launching)
- TIDAL desktop app (Electron-based, v2.39+)
- Node.js 20+
- `nowplaying-cli` (`brew install nowplaying-cli`) — for `status` command
- TIDAL developer credentials — for API commands

## License

ISC
