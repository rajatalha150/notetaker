# Notetaker Desktop

The native desktop manifestation of the Notetaker ecosystem, built with Electron and React.

## Overview

Unlike the browser extension which is limited to capturing tab audio, **Notetaker Desktop** leverages the `desktopCapturer` API to record **System Audio** and **Native Applications**. This makes it the perfect tool for capturing:
- **WhatsApp Desktop** calls
- **Skype** meetings
- **Zoom/Teams** native client sessions
- Any system-wide audio output

## Features

- **Studio View**: A high-fidelity recording environment with live animated waveforms.
- **Microphone Mixing**: High-performance WebAudio mixing of system audio + your local microphone.
- **Split-Channel Recording**: Automatically panner logic (Mic on Left, System on Right) to assist in AI diarization.
- **File-Backed Library**: Recordings are persisted as real `.webm` files in the Electron app data directory and surfaced through the shared metadata library.
- **Direct AI Processing**: Saved desktop recordings can be reopened and transcribed directly from the desktop detail view using the shared provider pipeline.
- **Deterministic Native Detection**: Before relying on manual hints, the desktop app attempts to derive platform and participant names from live native process/window metadata and UI automation first, then source/window titles, using app-specific parsing rules.
- **Shared Metadata & Settings**: Reuses the shared metadata schema, settings UI, and AI hooks through the `chrome-shim`.
- **Portable Distribution**: Packaged as a single `.AppImage` for Linux and `.exe` for Windows.

## Development

```bash
cd electron-app
npm install

# Run in development mode
npm run dev

# Build production binary
npm run build
```

## Production Layout

- **Main Process**: Handles native window management, source enumeration, recording file persistence, file reads/deletes, and system lifecycle.
- **Preload Script**: Secure bridge for desktop capture and recording-file IPC.
- **Renderer**: React 19 application using the shared AI hooks, shared settings screen, and desktop recorder workflow.

## Technical Details: The Chrome Shim

To maintain code parity with the extension, we've implemented a `chrome-shim.ts` in the renderer process. This emulates the subset of `chrome.storage.local` and `chrome.runtime` used by the shared code, while privileged file operations stay in Electron main via preload IPC. This allows the shared business logic in `src/shared/` to run in both environments without exposing Node APIs directly to the renderer.

## Current Parity Notes

- Desktop recording, transcription, summary, and settings flows are now wired end to end.
- Local AI assets are packaged under the paths expected by the shared WASM workers.
- Desktop now performs deterministic participant detection from native process/window metadata, UI automation, and source titles, and combines that with local speaker-event monitoring.
- Native-app speaker-name detection is still less mature than the browser extension's DOM-driven detector when apps do not expose useful process/window metadata/titles/UI elements, and that remains the main parity gap.

## License

Copyright (c) 2026 **Peak Services Inc.** All rights reserved. 
Visit [peakservices-inc.com](https://peakservices-inc.com) for enterprise-grade support.
