# Notetaker

A Chrome extension that silently records, transcribes, and summarizes your video calls — Google Meet, Zoom, and Microsoft Teams.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

## Features

- **Silent Call Recording** — Captures tab audio via `chrome.tabCapture` with optional microphone mixing. No screen-share prompts or visible indicators to remote participants.
- **AI Transcription** — Converts recordings to timestamped text using OpenAI Whisper, Groq, or high-performance local models.
- **Real-Time Speaker Identification** — Automatically detects your name and captures active speaker events from Google Meet, Zoom, and Microsoft Teams UIs.
- **Intelligent Diarization** — Correlates AI conversational analysis with real-time speaker metadata to assign actual names to every transcript segment.
- **AI Summarization** — Generates structured meeting summaries with key decisions, action items, and follow-ups.
- **Timestamped Notes** — Jot notes during the call, each tagged with the recording timestamp.
- **Multi-Provider AI & Local Models** — Use securely running local models directly inside your browser for 100% offline functionality, or connect cloud providers like OpenAI, Anthropic, Google Gemini, Groq, Together AI, and Deepgram!
- **Direct Download** — Audio files save straight to your Downloads folder, no cloud storage needed.

## Supported AI Providers

| Provider | Transcription | Summarization |
|----------|:---:|:---:|
| OpenAI | ✓ | ✓ |
| Anthropic | — | ✓ |
| Google Gemini | ✓ | ✓ |
| Groq | ✓ | ✓ |
| Together AI | — | ✓ |
| Deepgram | ✓ | — |
| Local In-Browser | ✓ | ✓ |

Use private offline WebAssembly models or any combination of cloud API providers to transcribe and summarize your meetings securely.

## Architecture

```
┌─────────────────┐     messages     ┌──────────────────────┐
│  Popup (React)  │ ◄──────────────► │  Background Service  │
│  - record/stop  │                  │  Worker (MV3)        │
│  - pause/resume │                  │  - state management  │
│  - quick notes  │                  │  - speaker logging   │
└─────────────────┘                  │  - download trigger  │
                                     └──────┬───────────────┘
┌─────────────────┐     messages            │ streamId
│  Side Panel     │ ◄──────────────►        ▼
│  (React +       │                  ┌──────────────────────┐
│   TanStack      │                  │  Offscreen Document  │
│   Router)       │                  │  - getUserMedia()    │
│  - history view │                  │  - WebAudio mixing   │
│  - transcribe   │                  │  - MediaRecorder     │
│  - summarize    │                  │  - chunks → dataURL  │
│  - settings     │                  └──────────────────────┘
└─────────────────┘
                                     ┌──────────────────────┐
                                     │  Content Script      │
                                     │  - platform detection│
                                     │  - speaker scraping  │
                                     └──────────────────────┘
```

Chrome MV3 service workers can't access DOM or media APIs. The service worker obtains a stream ID via `chrome.tabCapture.getMediaStreamId()` and passes it to an offscreen document for recording. While recording, the content script monitors the meeting UI for speaker changes and synchronizes these events with the background manager for final diarization.

## Setup & Development

### Prerequisites

- Node.js 18+
- An optional supported API key (OpenAI, Anthropic, Gemini, Groq, Together AI, Deepgram) OR use the default offline Local AI.

### Install & Run

```bash
git clone https://github.com/rajatalha150/notetaker.git
cd notetaker
npm install

# Development (hot reload)
npm run dev

# Production build
npm run build
```

### Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `dist/` folder

### Configure

1. Click the extension icon → **Open Side Panel**
2. Go to **Settings**
3. Enable "Cloud API Providers" if you wish to use external keys.
4. Select your preferred transcription and summarization models.
5. Click **Save Settings**

## Project Structure

```
src/
├── background/       # Service worker — recording state, speaker logs, downloads
├── content/          # Content script — platform-specific speaker detection & name scraping
├── offscreen/        # Offscreen document — tab capture, mic mixing, MediaRecorder
├── popup/            # Popup UI — record/stop/pause controls, quick notes
├── sidepanel/        # Main UI — recording history, transcription, summaries, settings
├── shared/
│   ├── types.ts      # Core types (RecordingMeta, SpeakerEvents, Settings)
│   ├── api/          # Unified Multi-provider & Local AI (WASM) layer
│   ├── storage/      # Settings & metadata persistence
│   └── hooks/        # React hooks for lifecycle & AI mutations
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| State/Router | TanStack Query & Router |
| Local AI | Transformers.js (WebAssembly) |
| Audio | `chrome.tabCapture` + WebAudio + MediaRecorder |
| AI Cloud | OpenAI, Anthropic, Google Gemini, Groq, Together, Deepgram |

## Privacy

- **On-Device Storage** — Audio is recorded locally and downloaded directly to your computer.
- **High-Privacy Mode** — Use the **Local (On-Device)** AI pipeline so your audio and transcripts never leave your hardware.
- **Anonymous Diarization** — Speaker names are scraped locally in your browser tab and never sent to cloud servers unless using a cloud AI provider for identification.
- **Secure Keys** — API keys are stored locally in your browser's encrypted `chrome.storage.local`.

## License

Copyright (c) 2026 Peak Services Inc. All rights reserved. 
Visit [peakservices-inc.com](https://peakservices-inc.com) for more information.
