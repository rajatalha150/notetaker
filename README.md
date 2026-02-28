# Notetaker

A privacy-first Chrome extension for recording audio during calls and meetings, with AI-powered transcription and summarization. Currently **free to use** — paid plans with additional features will be introduced as the product evolves.

## What It Does

Notetaker captures tab audio (and optionally your microphone) during calls on Google Meet, Zoom, Microsoft Teams, or any browser tab. The recording is invisible to the other party — no screen-share prompts, no visible indicators. When you stop recording, the audio file downloads directly to your computer as a `.webm` file.

Key features:
- **Silent tab audio capture** via Chrome's `tabCapture` API — no indicators shown to remote participants
- **Microphone mixing** — optionally record your own voice alongside the call
- **Timestamped quick notes** — jot notes during the call, each tagged with the recording timestamp
- **AI transcription** — send your recording to OpenAI's Whisper API for a full transcript with timestamps
- **AI summarization** — generate a concise summary with key decisions and action items
- **Direct download** — audio files save straight to your Downloads folder, no cloud storage

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

### Why an Offscreen Document?

Chrome MV3 service workers don't have access to DOM or media APIs (`MediaRecorder`, `AudioContext`, `getUserMedia`). The service worker obtains a `streamId` via `chrome.tabCapture.getMediaStreamId()` and passes it to an offscreen document that handles all actual audio capture and recording. When recording stops, the offscreen document assembles the audio blob, converts it to a data URL, and sends it back to the service worker, which triggers `chrome.downloads.download()`.

## File Structure

```
src/
├── background/
│   ├── index.ts              # Service worker entry, message listener
│   ├── recorder.ts           # Recording state, offscreen orchestration, download trigger
│   └── messages.ts           # Message handler dispatch (start/stop/pause/resume/notes)
│
├── offscreen/
│   ├── offscreen.html        # Minimal HTML for offscreen document
│   └── offscreen.ts          # Tab capture + mic mixing + MediaRecorder
│
├── popup/
│   ├── index.html            # Popup entry HTML
│   ├── main.tsx              # React mount + QueryClientProvider
│   ├── App.tsx               # Main popup layout
│   └── components/
│       ├── RecordingControls.tsx   # Start/stop/pause/resume buttons
│       ├── StatusIndicator.tsx     # Recording status dot + timer
│       └── QuickNotes.tsx          # Timestamped note input during recording
│
├── sidepanel/
│   ├── index.html            # Side panel entry HTML
│   ├── main.tsx              # React mount + RouterProvider + QueryClientProvider
│   ├── App.tsx               # Layout with nav bar + Outlet
│   ├── router.ts             # TanStack Router config (hash history)
│   ├── routes/
│   │   ├── recordings.tsx    # Recording history list
│   │   ├── recording.$id.tsx # Detail view: transcribe, summarize, notes
│   │   └── settings.tsx      # API key configuration
│   └── components/
│       ├── RecordingCard.tsx       # Recording list item
│       ├── TranscriptionView.tsx   # Timestamped transcript display
│       ├── SummaryView.tsx         # AI summary display
│       └── NotesEditor.tsx         # Notes list with copy
│
├── content/
│   └── detector.ts           # Detects Google Meet / Zoom / Teams pages
│
├── shared/
│   ├── types.ts              # RecordingMeta, Note, Transcription, Settings
│   ├── messages.ts           # Message types + sendToBackground() + broadcast()
│   ├── query-client.ts       # TanStack Query client instance
│   ├── storage/
│   │   ├── metadata.ts       # Recording metadata CRUD (chrome.storage.local)
│   │   └── settings.ts       # Settings read/write (chrome.storage.local)
│   ├── hooks/
│   │   ├── useRecordingState.ts   # Live recording status + controls
│   │   ├── useRecordings.ts       # Recording history list
│   │   ├── useNotes.ts            # Add notes during recording
│   │   ├── useTranscription.ts    # Whisper transcription trigger + cache
│   │   └── useSummary.ts          # Summarization trigger + cache
│   └── api/
│       ├── whisper.ts        # OpenAI Whisper API client
│       └── claude.ts         # Anthropic Claude API client
│
└── styles/
    └── globals.css           # Tailwind CSS v4 import
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Async State | TanStack Query v5 |
| Routing | TanStack Router (hash history for extension) |
| Build | Vite 5 + CRXJS (MV3 Chrome extension bundling) |
| Storage | `chrome.storage.local` for metadata/settings |
| Audio | `chrome.tabCapture` + WebAudio API + MediaRecorder |
| AI | OpenAI Whisper (transcription) + Anthropic Claude (summarization) |

## Data Flow

### Recording
1. User clicks **Start Recording** in popup
2. Popup sends `START_RECORDING` message to background with the active tab ID
3. Background calls `chrome.tabCapture.getMediaStreamId()` to get a stream ID
4. Background creates an offscreen document and sends the stream ID to it
5. Offscreen document calls `getUserMedia()` with the stream ID, mixes tab + mic via WebAudio, starts `MediaRecorder`
6. Chunks accumulate in memory in the offscreen document
7. User clicks **Stop Recording**
8. Offscreen document stops the recorder, assembles chunks into a blob, converts to data URL, sends back to background
9. Background triggers `chrome.downloads.download()` — file saves to Downloads as `.webm`
10. Recording metadata (title, duration, notes) saved to `chrome.storage.local`

### Transcription
1. User opens recording detail in side panel, clicks **Transcribe**
2. File picker opens — user selects the downloaded `.webm` file
3. File is sent to OpenAI Whisper API
4. Transcript (with timestamps) is cached in recording metadata

### Summarization
1. After transcription, user clicks **Summarize**
2. Transcript + any manual notes are sent to Claude API
3. Summary is cached in recording metadata

## Setup & Development

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Production build
npm run build
```

### Load in Chrome
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Configure API Keys
1. Click the extension icon → **Open Side Panel**
2. Go to **Settings**
3. Enter your OpenAI API key (for Whisper transcription)
4. Enter your Anthropic API key (for Claude summarization)
5. Click **Save Settings**

## Privacy

- Tab audio is captured via `chrome.tabCapture` — this does **not** trigger any screen-share prompt or visible indicator to remote call participants
- Audio is recorded locally in the browser and downloaded directly to your computer
- No audio data is stored in the browser after download
- API calls to Whisper and Claude only happen when you explicitly trigger them
- API keys are stored locally in `chrome.storage.local`

## Permissions

| Permission | Purpose |
|-----------|---------|
| `tabCapture` | Capture audio from browser tabs |
| `activeTab` | Access the currently active tab for recording |
| `storage` | Store recording metadata and settings |
| `sidePanel` | Side panel UI for history and detail views |
| `offscreen` | Offscreen document for media recording (MV3 requirement) |
| `downloads` | Auto-download recorded audio files |

## License

All rights reserved.
