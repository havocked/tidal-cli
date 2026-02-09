# tidal-cli

CLI to control the [TIDAL](https://tidal.com) desktop app from the command line.

Works by talking to the Electron app via **Chrome DevTools Protocol** (CDP) — no API keys, no auth tokens, no DRM hacking. Just piggybacks on the running, logged-in desktop app.

## How it works

```
┌─────────┐     CDP/WebSocket      ┌──────────────┐     IPC      ┌──────────────┐
│ tidal-cli│ ──────────────────────▶│ TIDAL Electron│ ───────────▶│ TIDALPlayer  │
│ (Node.js)│◀────────────────────── │ (Renderer)    │◀─────────── │ (native arm64)│
└─────────┘  JS eval + DOM clicks  └──────────────┘  JSON stdin  └──────────────┘
                                           │
                                    macOS NowPlaying
                                           │
                                    ┌──────────────┐
                                    │nowplaying-cli │ ◀── tidal-cli status
                                    └──────────────┘
```

1. TIDAL desktop app launches with `--remote-debugging-port=9222`
2. `tidal-cli` connects via WebSocket to evaluate JavaScript in the renderer
3. Navigation: sets `window.location.href` to desktop.tidal.com URLs
4. Playback control: clicks transport buttons (Play, Pause, Next, etc.) via DOM
5. Status: reads macOS Now Playing info via `nowplaying-cli`

## Install

```bash
# Prerequisites
brew install nowplaying-cli

# Clone and build
git clone https://github.com/havocked/tidal-cli.git
cd tidal-cli
npm install
npm run build
```

## Setup

TIDAL must be running with remote debugging enabled. The CLI will auto-launch it if needed:

```bash
# Manual launch (or let tidal-cli handle it)
open -a TIDAL --args --remote-debugging-port=9222
```

> **Tip:** Set up a launchd plist to always start TIDAL with the debug port.

## Usage

```bash
# Play a playlist
tidal-cli play playlist/699e5b55-274b-499c-b995-dcefa5e5921b

# Play a track (by ID or full URL)
tidal-cli play 251380837
tidal-cli play https://tidal.com/browse/track/251380837

# Play an album
tidal-cli play album/251380836

# Playback control
tidal-cli pause
tidal-cli resume
tidal-cli next
tidal-cli prev

# Toggle shuffle / repeat
tidal-cli shuffle
tidal-cli repeat

# Check what's playing
tidal-cli status
tidal-cli status --json

# Volume
tidal-cli volume        # Show current
tidal-cli volume 80     # Set to 80%
```

## Resource formats

The `play` command accepts multiple formats:

| Format | Example |
|--------|---------|
| Full URL | `https://tidal.com/browse/track/251380837` |
| Listen URL | `https://listen.tidal.com/playlist/xxx` |
| Short | `track/251380837` |
| Short | `playlist/699e5b55-...` |
| Bare ID (→ track) | `251380837` |
| Bare UUID (→ playlist) | `699e5b55-274b-499c-b995-dcefa5e5921b` |

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `TIDAL_CDP_PORT` | `9222` | CDP WebSocket port |
| `TIDAL_APP_PATH` | `/Applications/TIDAL.app` | Path to TIDAL app |

## Architecture

```
src/
  cli.ts                  # Commander entry point
  commands/
    play.ts               # Navigate to resource + click Play
    playback.ts           # pause, resume, next, prev, shuffle, repeat
    status.ts             # Now playing via nowplaying-cli
    volume.ts             # Volume get/set via DOM slider
  services/
    cdp.ts                # CDP WebSocket client (connect, evaluate JS, click buttons)
    nowplaying.ts         # nowplaying-cli wrapper for playback status
    launcher.ts           # Ensure TIDAL is running with CDP enabled
  lib/
    config.ts             # Configuration (ports, paths, timeouts)
```

## Roadmap

- **Phase 1 (current):** Basic playback control via CDP
- **Phase 2:** Queue management, search
- **Phase 3:** Integration with [curator](https://github.com/havocked/curator) for playlist → play workflows

## Requirements

- macOS (uses macOS-specific nowplaying-cli and app launching)
- TIDAL desktop app (Electron, v2.39+)
- Node.js 20+
- `nowplaying-cli` (for status command)

## License

ISC
