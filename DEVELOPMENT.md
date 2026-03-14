# Developer Guide: Notetaker Engineering

This document outlines the technical architecture and development patterns used across the Notetaker ecosystem.

## Project Structure

```
notetaker/
├── dist/               # Built extension (load in Chrome)
├── src/                # Shared & Extension Source
│   ├── background/     # Extension Service Worker
│   ├── offscreen/      # Media recording logic
│   ├── content/        # UI Scraping & Speaker Detection
│   └── shared/         # CRITICAL: Reusable AI and Storage code
└── electron-app/       # Native Desktop Implementation
    ├── electron/       # Main & Preload scripts
    ├── src/            # Desktop-specific UI & Shims
    └── release/        # Built binaries (AppImage/Exe)
```

## Shared Code Architecture

The heart of the project is `src/shared/`. We follow a **Shared-First** philosophy:
- **`src/shared/api/`**: Contains the logic for all AI providers (OpenAI, Anthropic, etc.) and the Local WASM workers.
- **`src/shared/storage/`**: Handles metadata persistence. The same storage API is used in both environments, while Desktop uses a `chrome-shim` for metadata/settings and Electron-managed files for the raw recording assets.
- **`src/shared/hooks/`**: React hooks for transcription, summarization, and audio handling.

## Audio Engineering

- **Extension**: Uses `chrome.tabCapture` to get a stream ID, then passes it to an Offscreen Document.
- **Desktop**: Uses `desktopCapturer.getSources` to obtain a `chromeMediaSourceId`, captures it via `navigator.mediaDevices.getUserMedia`, and persists the final `.webm` file through Electron IPC into the app-managed recordings directory.
- **Mixing**: Both environments use a custom WebAudio graph to mix the system audio with the user's microphone in real-time before passing it to the `MediaRecorder`.

## Speaker Detection Engine

In `src/content/detector.ts`, we implement platform-specific observers:
- **Google Meet**: Observes avatar pulses and name tags.
- **Teams**: Monitors the participant list and active speaker highlights.
- **Zoom**: Scrapes metadata from the web client interface.

These events are sent to the `metadata.ts` layer, which tags the current audio chunk with the speaker's name.

## Building for Production

### Chrome Extension
```bash
npm run build
```
This runs Vite with the root `vite.config.ts`. Output is in `dist/`.

### Desktop App
```bash
cd electron-app
npm run build
```
This compiles the TypeScript main process, bundles the renderer with Vite, and then uses `electron-builder` to package the final binary.

## Current Desktop State

- Desktop recordings are created in the renderer, then written to disk by Electron main via preload IPC.
- The desktop library can reopen saved files and pass them back into the shared transcription pipeline directly.
- The desktop app now reuses the shared settings screen, summary flow, and metadata schema.
- Desktop now attempts deterministic native participant detection from live process/window metadata first and source titles second, and records those names separately from manual fallback hints.
- Remaining parity work is focused on deeper native-app integrations beyond current window metadata/title extraction and any future true cross-app library sync.

## License

Copyright (c) 2026 **Peak Services Inc.** All rights reserved.
Proprietary software.
