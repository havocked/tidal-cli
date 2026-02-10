# Architecture

## Overview

tidal-cli has two layers:

1. **CDP layer** — controls the TIDAL desktop app (Electron) via Chrome DevTools Protocol. No auth needed.
2. **API layer** — accesses the TIDAL catalog via the official `@tidal-music/api` SDK. Requires OAuth.

## System Components

```
┌──────────────────────────────────────────────────────────────┐
│                        macOS                                  │
│                                                               │
│  ┌──────────┐    CDP (ws://9222)    ┌────────────────────┐   │
│  │ tidal-cli │ ◄──────────────────► │    TIDAL.app       │   │
│  │ (Node.js) │                      │  ┌──────────────┐  │   │
│  └──────────┘                       │  │  Electron     │  │   │
│       │                             │  │  (Renderer)   │  │   │
│       │ exec                        │  └──────┬───────┘  │   │
│       ▼                             │         │ IPC      │   │
│  ┌──────────────┐                   │  ┌──────▼───────┐  │   │
│  │nowplaying-cli│◄─── NowPlaying ───│  │ TIDALPlayer  │  │   │
│  │ (status only)│    Framework      │  │ (native arm64│  │   │
│  └──────────────┘                   │  │  audio/DRM)  │  │   │
│                                     │  └──────────────┘  │   │
│  ┌──────────┐                       └────────────────────┘   │
│  │ tidal-cli │──── HTTPS ────► openapi.tidal.com             │
│  │ (API cmds)│                 (search, playlists, sync)     │
│  └──────────┘                                                │
└──────────────────────────────────────────────────────────────┘
```

## Source Layout

```
src/
  cli.ts                       # Commander entry point
  commands/
    play.ts                    # Navigate to resource + click Play (CDP)
    playback.ts                # pause, resume, next, prev, shuffle, repeat (CDP)
    status.ts                  # Now playing via nowplaying-cli
    volume.ts                  # Volume get/set via DOM slider (CDP)
    auth.ts                    # OAuth PKCE login/status/logout (API)
    search.ts                  # Catalog search (API)
    playlist.ts                # Create playlists (API)
    sync.ts                    # Fetch favorite tracks (API)
  services/
    cdp.ts                     # CDP WebSocket client
    nowplaying.ts              # nowplaying-cli wrapper
    launcher.ts                # Ensure TIDAL is running with CDP
    nodeStorage.ts             # localStorage polyfill for SDK auth
    tidal/                     # TIDAL API client (official SDK)
      client.ts                # SDK init, singleton management
      types.ts                 # API types and constants
      fetcher.ts               # Batch track fetcher
      mappers.ts               # JSON:API → Track mapping
      search.ts                # Search endpoints
      artists.ts               # Artist endpoints
      albums.ts                # Album endpoints
      playlists.ts             # Playlist + favorites endpoints
      tracks.ts                # Track + similar + radio endpoints
      index.ts                 # Barrel exports
  lib/
    config.ts                  # Configuration (ports, paths, timeouts)
    paths.ts                   # Path utilities
    logger.ts                  # stderr logger
    retry.ts                   # HTTP retry with backoff
```

## Design Decisions

### Why CDP for playback?

| Approach | Pros | Cons |
|----------|------|------|
| **CDP (chosen)** | Full control, no auth, stable | Requires `--remote-debugging-port` flag |
| Direct TIDALPlayer binary | Lower level | Need to handle auth/DRM ourselves |
| AppleScript/Accessibility | No special launch flags | Limited control, permission issues |
| Media key simulation | Simple | Can't navigate/play specific content |
| TIDAL API (OAuth) | Official | Can't control playback (DRM streams) |

### Why the official SDK for catalog access?

The `@tidal-music/api` SDK provides typed access to the TIDAL catalog (search, playlists, favorites). It handles OAuth PKCE, token refresh, and JSON:API response parsing.

### Why nowplaying-cli for status?

The macOS Now Playing framework provides accurate, real-time playback info without CDP overhead. Separating "read" (nowplaying-cli) from "write" (CDP) keeps things simple and fast.

### Why auto-launch?

Users shouldn't need to remember special flags. The CLI ensures TIDAL is running with CDP enabled, relaunching if needed.
