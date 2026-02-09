# Architecture & System Sequence Diagrams

## Overview

tidal-cli controls the TIDAL desktop app without needing API credentials or authentication. It uses Chrome DevTools Protocol to execute JavaScript inside the running Electron app, and reads playback status from the macOS Now Playing system.

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
│                                     └────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Sequence Diagrams

### 1. Play a playlist

```
User              tidal-cli           Launcher           CDP              TIDAL App
 │                    │                  │                 │                  │
 │ play playlist/xxx  │                  │                 │                  │
 │───────────────────►│                  │                 │                  │
 │                    │ isCDPAvailable?  │                 │                  │
 │                    │─────────────────►│                 │                  │
 │                    │    true          │                 │                  │
 │                    │◄─────────────────│                 │                  │
 │                    │                  │                 │                  │
 │                    │ navigate(desktop.tidal.com/playlist/xxx)              │
 │                    │────────────────────────────────────►                  │
 │                    │                  │                 │  window.location │
 │                    │                  │                 │─────────────────►│
 │                    │                  │                 │                  │
 │                    │ (wait 2s for page load)            │                  │
 │                    │                  │                 │                  │
 │                    │ clickButton("Play")                │                  │
 │                    │────────────────────────────────────►                  │
 │                    │                  │                 │  btn.click()     │
 │                    │                  │                 │─────────────────►│
 │                    │                  │                 │                  │──► Audio plays
 │                    │                  │                 │                  │
 │                    │ getNowPlaying()  │                 │                  │
 │                    │──► nowplaying-cli│                 │                  │
 │                    │◄── title/artist  │                 │                  │
 │                    │                  │                 │                  │
 │ ♫ Title — Artist   │                  │                 │                  │
 │◄───────────────────│                  │                 │                  │
```

### 2. Auto-launch TIDAL (cold start)

```
User              tidal-cli           Launcher           TIDAL App
 │                    │                  │                  │
 │ pause              │                  │                  │
 │───────────────────►│                  │                  │
 │                    │ isCDPAvailable?  │                  │
 │                    │─────────────────►│                  │
 │                    │    false         │                  │
 │                    │◄─────────────────│                  │
 │                    │                  │                  │
 │                    │ isTidalRunning?  │                  │
 │                    │─────────────────►│                  │
 │                    │    true (no CDP) │                  │
 │                    │◄─────────────────│                  │
 │                    │                  │                  │
 │                    │ quit + relaunch  │                  │
 │                    │─────────────────►│                  │
 │                    │                  │──quit───────────►│
 │                    │                  │                  X
 │                    │                  │                  │
 │                    │                  │──open --args     │
 │                    │                  │  --remote-debug  │
 │                    │                  │─────────────────►│ (new process)
 │                    │                  │                  │
 │                    │                  │ poll CDP /json   │
 │                    │                  │─────────────────►│
 │                    │                  │◄─────────────────│
 │                    │   ready          │                  │
 │                    │◄─────────────────│                  │
 │                    │                  │                  │
 │                    │ (proceed with command)              │
```

### 3. Status check (no CDP needed)

```
User              tidal-cli         nowplaying-cli      macOS NowPlaying
 │                    │                  │                  │
 │ status             │                  │                  │
 │───────────────────►│                  │                  │
 │                    │ get-raw          │                  │
 │                    │─────────────────►│                  │
 │                    │                  │  query           │
 │                    │                  │─────────────────►│
 │                    │                  │  title/artist/   │
 │                    │                  │  duration/rate   │
 │                    │                  │◄─────────────────│
 │                    │ NowPlayingInfo   │                  │
 │                    │◄─────────────────│                  │
 │                    │                  │                  │
 │ ▶ Title            │                  │                  │
 │   Artist: ...      │                  │                  │
 │   Time: 1:23/4:56  │                  │                  │
 │◄───────────────────│                  │                  │
```

## Design Decisions

### Why CDP over other approaches?

| Approach | Pros | Cons |
|----------|------|------|
| **CDP (chosen)** | Full control, no auth, stable | Requires `--remote-debugging-port` flag |
| Direct TIDALPlayer binary | Lower level | Need to handle auth/DRM ourselves |
| AppleScript/Accessibility | No special launch flags | Limited control, permission issues |
| Media key simulation | Simple | Can't navigate/play specific content |
| Tidal API (OAuth) | Official | Playback control ≠ API (DRM streams) |

### Why nowplaying-cli for status?

The macOS Now Playing framework provides accurate, real-time playback info without any CDP overhead. It's the same data that shows in Control Center. Separating "read" (nowplaying-cli) from "write" (CDP) keeps things simple and fast.

### Why auto-launch?

Users shouldn't need to remember special flags. The CLI handles ensuring TIDAL is running correctly, relaunching with CDP if needed. This makes it agent-friendly (Ori can just run commands without manual setup).
