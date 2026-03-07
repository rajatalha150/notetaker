# Notetaker

A Chrome extension that silently records, transcribes, and summarizes your video calls — Google Meet, Zoom, and Microsoft Teams.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

## Features

- **Silent Call Recording** — Captures tab audio via `chrome.tabCapture` with optional microphone mixing. No screen-share prompts or visible indicators to remote participants.
- **AI Transcription** — Converts recordings to timestamped text using OpenAI Whisper or Groq Whisper
- **Speaker Diarization** — Automatically identifies and labels distinct speakers
- **AI Summarization** — Generates structured meeting summaries with key decisions, action items, and follow-ups
- **Timestamped Notes** — Jot notes during the call, each tagged with the recording timestamp
- **Multi-Provider AI & Local Models** — Use securely running local models directly inside your browser for completely offline functionality, or connect cloud providers like OpenAI, Anthropic, Google Gemini, Groq, Together AI, and Deepgram!
- **Direct Download** — Audio files save straight to your Downloads folder, no cloud storage

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
│  - quick notes  │                  │  - message dispatch  │
└─────────────────┘                  │  - download trigger  │
                                     └──────┬───────────────┘
┌─────────────────┐     messages            │ streamId
│  Side Panel     │ ◄──────────────►        ▼
│  (React +       │                  ┌──────────────────────┐
│   TanStack      │                  │  Offscreen Document  │
│   Router)       │                  │  - getUserMedia()    │
│  - history      │                  │  - WebAudio mixing   │
│  - transcribe   │                  │  - MediaRecorder     │
│  - summarize    │                  │  - chunks → dataURL  │
│  - settings     │                  └──────────────────────┘
└─────────────────┘
                                     ┌──────────────────────┐
                                     │  Content Script      │
                                     │  - detects Meet/     │
                                     │    Zoom/Teams pages  │
                                     └──────────────────────┘
```

Chrome MV3 service workers can't access DOM or media APIs. The service worker obtains a stream ID via `chrome.tabCapture.getMediaStreamId()` and passes it to an offscreen document that handles all audio capture and recording.

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
3. Add API keys for your preferred providers
4. Select transcription and summarization provider/model
5. Click **Save Settings**

## Usage

1. Join a Google Meet, Zoom, or Teams call
2. Open the Notetaker side panel
3. Click **Record** to start capturing
4. Add timestamped notes during the call
5. Stop recording — audio downloads automatically
6. Click **Transcribe** for a full transcript
7. Click **Summarize** for a structured summary

## Project Structure

```
src/
├── background/       # Service worker — recording state, message dispatch, downloads
├── content/          # Content script — detects Meet/Zoom/Teams pages
├── offscreen/        # Offscreen document — tab capture, mic mixing, MediaRecorder
├── popup/            # Popup UI — record/stop/pause controls, quick notes
├── sidepanel/        # Main UI — recording history, transcription, summaries, settings
│   ├── routes/       # Page routes (recordings list, detail view, settings)
│   └── components/   # RecordingCard, TranscriptionView, SummaryView, NotesEditor
├── permissions/      # Permission request flow
└── shared/
    ├── types.ts      # Core types (RecordingMeta, Settings, Transcription)
    ├── api/
    │   ├── providers.ts  # Unified multi-provider API layer
    │   └── models.ts     # Model catalog with capability flags
    ├── storage/      # Settings & metadata persistence (chrome.storage.local)
    └── hooks/        # React hooks (useRecordings, useTranscription, useSummary)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| State | TanStack Query v5 |
| Routing | TanStack Router (hash history) |
| Build | Vite 5 + CRXJS |
| Storage | `chrome.storage.local` |
| Audio | `chrome.tabCapture` + WebAudio + MediaRecorder |
| AI | Transformers.js (Local), OpenAI, Anthropic, Google Gemini, Groq, Together AI, Deepgram |

## Privacy

- Audio is recorded locally and downloaded directly to your computer
- Highly Sensitive calls can use the **Local (On-Device)** AI pipeline, ensuring voice/text never touches a server.
- No audio is stored in the browser after download
- AI API calls only happen when you explicitly trigger transcription/summarization
- API keys are stored locally in `chrome.storage.local`
- Tab capture does **not** trigger screen-share prompts visible to other participants

## Chrome Permissions

| Permission | Purpose |
|-----------|---------|
| `tabCapture` | Capture audio from browser tabs |
| `activeTab` | Access the active tab for recording |
| `storage` | Store recording metadata and settings |
| `sidePanel` | Side panel UI |
| `offscreen` | Offscreen document for media recording |
| `downloads` | Auto-download recorded audio files |

## License

Copyright (c) 2026 Peak Services Inc. All rights reserved. 
Visit [peakservices-inc.com](https://peakservices-inc.com) for more information.
