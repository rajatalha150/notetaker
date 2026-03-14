# Notetaker (Omni-Channel)

A privacy-first AI meeting assistant that silently records, transcribes, and summarizes your video calls across both browsers and native desktop applications.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome&logoColor=white)
![Desktop App](https://img.shields.io/badge/Desktop-App-purple?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

## High-Level Capabilities

- **Browser Extension** — Silent recording for Google Meet, Zoom, and Microsoft Teams tabs. No participants are notified.
- **Native Desktop App** — "Studio" environment to capture high-quality audio from native apps like **Skype**, **Zoom Desktop**, **WhatsApp**, and **Teams Native**, then save and reopen those captures directly from the desktop library.
- **AI Transcription** — Timestamped text via OpenAI Whisper, Groq, or high-performance **Local Models** (100% on-device).
- **Speaker Detection** — Uses deterministic app data when available: browser DOM scraping on the extension side, and native window/source title parsing plus speaker-event monitoring on Desktop.
- **AI Summarization** — Structured meeting summaries with action items and key decisions.
- **Privacy First** — All audio stays on your hardware. Use Local AI (WASM) to ensure no data ever leaves your machine.

---

## 🚀 Getting Started

### 1. Browser Extension
Ideal for web-based meetings.
- **Build**: `npm run build` from the root directory.
- **Load**: Go to `chrome://extensions`, enable Dev Mode, and load the `dist/` folder.
- **Use**: Open the side panel, enter a meeting, and click "Record".

### 2. Desktop Application
Ideal for native apps and system-wide audio capture.
- **Directory**: `cd electron-app`
- **Build**: `npm run build`
- **Deploy**: Run the generated `.AppImage` (Linux) or portable `.exe` (Windows) in the `release/` folder.

---

## Architecture

```
                                 ┌──────────────────────┐
                                 │   SHARED AI CORE     │
                                 │ - Whisper (Local/API)│
                                 │ - Qwen (Local/API)   │
                                 └──────────┬───────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
          ┌───────────────────┐                           ┌───────────────────┐
          │  CHROME EXTENSION │                           │    DESKTOP APP    │
          │ (Browser Context) │                           │ (Electron/Native) │
          ├───────────────────┤                           ├───────────────────┤
          │ - Tab Capture API │                           │ - DesktopCapturer │
          │ - DOM Scraping    │                           │ - System Audio    │
          │ - Side Panel UI   │                           │ - Studio UI       │
          └───────────────────┘                           └───────────────────┘
```

The project utilizes a **Shared AI Core** and a **Chrome-Shim** layer. This allows the Desktop application to leverage the same encryption, storage, and AI logic as the extension, ensuring your meeting history is consistent across your entire device.

Today the extension and desktop app share the same data model, AI pipeline, and settings UI, while persisting data in their own runtime-appropriate local stores. Desktop recordings are stored as real files managed by Electron, can be transcribed directly from the desktop library without manual file re-selection, and now attempt deterministic participant-name discovery from native source/window titles before falling back to manual hints.

---

## Setup & Development

### Prerequisites
- Node.js 18+
- Optional API keys (OpenAI, Anthropic, Gemini, Groq, etc.) for cloud processing.

### Developer Installation
```bash
git clone https://github.com/rajatalha150/notetaker.git
cd notetaker

# Build Extension
npm install
npm run build

# Build Desktop App
cd electron-app
npm install
npm run build
```

---

## Tech Stack

| Component | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript |
| **Styling** | Tailwind CSS v4 (Modern HSL tokens) |
| **State/Query** | TanStack Query & Router |
| **Local AI** | Transformers.js (Whisper, Qwen, DeepSeek) |
| **Native Layer** | Electron, IPC, Node.js |
| **Audio** | `tabCapture`, `MediaRecorder`, WebAudio API |

---

## License

Copyright (c) 2026 **Peak Services Inc.** All rights reserved. 
Unauthorized copying of this project, via any medium, is strictly prohibited.
Proprietary and confidential.

Visit [peakservices-inc.com](https://peakservices-inc.com) for enterprise licenses and support.
