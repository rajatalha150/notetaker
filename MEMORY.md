# Notetaker — AI Memory Palace

> A-Z knowledge base for AI agents working on this project.
> Enter through any door; the rooms are all connected.

```
  ┌─────────────────────────────────────────────┐
  │            NOTETAKER MEMORY PALACE           │
  │  Privacy-first AI meeting assistant          │
  │  Chrome Extension + Electron Desktop App     │
  └─────────────────────────────────────────────┘
```

---

## 🏛️ The Foyer — Project Identity

- **Name**: Notetaker (Omni-Channel)
- **Purpose**: Silent recording, transcription, and summarization of video calls
- **Tagline**: "Privacy-first AI meeting assistant"
- **Company**: Peak Services Inc. (proprietary)
- **Repository**: `github.com/rajatalha150/notetaker`
- **Branch**: `desktop-app`
- **Tech Stack**: React 19, TypeScript 5, Tailwind v4, TanStack Query/Router, Transformers.js, Electron 33, Vite 5
- **License**: Proprietary — all rights reserved

---

## 🧭 The Map Room — Project Layout

```
notetaker/
├── src/                        # Browser Extension + Shared Code
│   ├── background/             # Service Worker (recording orchestration)
│   ├── offscreen/              # Offscreen document (media capture)
│   ├── content/                # DOM scrapers for speaker detection
│   ├── permissions/            # Mic permission page (HTML+TS)
│   ├── popup/                  # Extension popup UI
│   ├── sidepanel/              # Side panel UI (main workspace)
│   └── shared/                 # Shared AI, storage, hooks, utilities
├── electron-app/               # Desktop app (Electron)
│   ├── electron/               # Main + preload scripts
│   └── src/                    # Desktop renderer + chrome-shim
├── dist/                       # Built extension output
├── README.md                   # Project overview
├── DEVELOPMENT.md              # Developer guide
└── MEMORY.md                   # ← YOU ARE HERE
```

---

## 🧠 The Library — Shared Code (`src/shared/`)

This is the brain of the project. Everything important lives here.

### 📦 Types (`src/shared/types.ts`)
- `RecordingMeta` — Full recording metadata (title, duration, platform, notes, transcription, summary, speaker events, file info)
- `Transcription` / `TranscriptionSegment` — Timestamped text segments with optional speaker labels
- `Note` — Timestamped user notes attached to a recording
- `Settings` — All configurable settings (provider keys, model selection, audio format, mic toggle)
- `Provider` — `"openai" | "anthropic" | "gemini" | "groq" | "together" | "deepgram" | "local"`
- `RecordingStatus` — `"idle" | "recording" | "paused" | "stopped"`
- `SpeakerEvent` — Who spoke when (name + timestamp offset)

### 🗄️ Storage (`src/shared/storage/`)
| File | Purpose |
|------|---------|
| `metadata.ts` | CRUD for `RecordingMeta[]` in `chrome.storage.local` under key `"recordings"` |
| `settings.ts` | CRUD + normalization for `Settings` |
| `audio-assets.ts` | Store/retrieve/delete audio blobs via `chrome.storage.local` |

### 🔌 API Layer (`src/shared/api/`)
| File | Purpose |
|------|---------|
| `providers.ts` | AI provider config, model lists, audio preprocessing, prompt truncation for local models |
| `models.ts` | Model registry with labels, capabilities, and speed tiers |
| `transcribeWorker.ts` | Web Worker — runs Whisper transcription (WASM/ONNX) |
| `chatWorker.ts` | Web Worker — runs local summarization (Qwen, TinyLlama, Phi-3 via WASM/ONNX) |
| `export.ts` | Export pipeline — Markdown, JSON, Rich HTML, SRT, VTT, Action Items, Email Draft, TXT transcript |

### 🪝 Hooks (`src/shared/hooks/`)
| Hook | Purpose |
|------|---------|
| `useRecordings.ts` | List all recordings, delete one (via `useQuery` + `useMutation`) |
| `useRecordingState.ts` | Current recording status synced via `chrome.runtime.onMessage` |
| `useNotes.ts` | Fetch/add notes for a recording |
| `useTranscription.ts` | Transcribe — file picker, saved file, or upload blob |
| `useSummary.ts` | Summarize — calls provider pipeline |

### 🧰 Utilities (`src/shared/`)
| File | Purpose |
|------|---------|
| `format.ts` | Consolidated formatters: `formatTime`, `formatTimestamp`, `formatDuration`, `formatClock`, `escapeHtml`, `renderMarkdown` |
| `confirm-dialog.tsx` | Modal confirmation dialog (Escape key, backdrop dismiss, danger/default variants) |
| `error-boundary.tsx` | React error boundary for catching render crashes |
| `messages.ts` | Typed `sendToBackground()` and `broadcast()` helpers |
| `query-client.ts` | TanStack Query client singleton |
| `recording-assets.ts` | Get recording audio file from extension cache or Electron IPC |

---

## 🖥️ The Gallery — UI Components

### Side Panel (`src/sidepanel/`)
| File | Purpose |
|------|---------|
| `App.tsx` | Root layout with nav (Recordings / Settings) |
| `router.ts` | TanStack Router with hash history |
| `routes/recordings.tsx` | Recording list with loading, empty, and populated states |
| `routes/recording.$id.tsx` | Recording detail — transcribe, summarize, export buttons, notes |
| `routes/settings.tsx` | Provider keys, model selection, mic toggle, local/cloud toggle |
| `components/RecordingCard.tsx` | Card with title, date, duration, badges, delete button |
| `components/ExportMenu.tsx` | Dropdown with all export options (8 formats) |
| `components/TranscriptionView.tsx` | Speaker-color-coded transcript segments |
| `components/SummaryView.tsx` | Rendered markdown summary with copy button |
| `components/NotesEditor.tsx` | Timestamped note list with copy-all |

### Popup (`src/popup/`)
| File | Purpose |
|------|---------|
| `App.tsx` | Main popup — recording controls + status + quick notes |
| `components/RecordingControls.tsx` | Record/Stop/Pause/Resume buttons with icons |
| `components/StatusIndicator.tsx` | Dot + label + clock for current recording state |
| `components/QuickNotes.tsx` | Inline note input + recent notes list |

### Permissions (`src/permissions/`)
| File | Purpose |
|------|---------|
| `index.html` | Polished dark-themed mic permission page with icon, button, status |
| `permissions.ts` | Permission check flow — detect granted/denied, auto-start recording |

---

## ⚙️ The Workshop — Build System

### Root (Extension)
```bash
npm install
npm run build          # Vite build → dist/
```

### Desktop App
```bash
cd electron-app
npm install
npm run dev            # Dev mode with hot reload
npm run build          # tsc + vite + electron-builder (all targets)
npm run build:deb      # .deb only
npm run build:appimage # AppImage only
```

### Key Config Files
- `vite.config.ts` — Build config for extension + offscreen + workers
- `electron-app/vite.config.ts` — Electron + renderer build
- `tsconfig.json` — Strict TS with `@shared/*` path alias, `noUncheckedIndexedAccess`
- `package.json` (electron-app) — electron-builder config for `.deb`, `.AppImage`

---

## 🧪 The Laboratory — AI & Audio Pipeline

### Recording Flow (Extension)
```
User clicks Record → chrome.tabCapture → Offscreen document
  → getUserMedia (mic) → WebAudio mixer → MediaRecorder
  → chunks → final blob → chrome.storage.local
```

### Recording Flow (Desktop)
```
User clicks Record → desktopCapturer.getSources → getUserMedia (system + mic)
  → WebAudio mixer (mic left, system right) → MediaRecorder
  → chunks → Electron IPC → saved as .webm file
```

### Transcription Flow
```
Recording saved → User clicks "Transcribe"
  → Select file (or auto-load saved desktop file)
  → transcribeWorker.ts (WASM Whisper) or cloud API
  → Transcription segments with speaker labels → stored in metadata
```

### Summarization Flow
```
Transcription done → User clicks "Summarize"
  → chatWorker.ts (local Qwen/TinyLlama) or cloud API
  → Structured summary with action items → stored in metadata
```

### Speaker Detection (Extension)
```
Content script (detector.ts) observes DOM for Meet/Teams/Zoom
  → Sends SPEAKER_ACTIVE messages to background
  → Tracked in metadata via speakerEvents[]
```

### Speaker Detection (Desktop)
```
Native window metadata parsing + UI automation
  → DesktopParticipantProbeResult
  → Fallback: source title parsing → manual hint
```

---

## 🎨 The Design Studio — UI Patterns

### Tailwind v4
- Dark theme: `bg-gray-950` base, `bg-gray-900/50` cards, `gray-400` text, `gray-600` muted
- Accents: `red-600` (record), `blue-600` (transcribe), `purple-600` (summarize)
- Cards: `rounded-lg border border-gray-800/50 bg-gray-900/50`
- Animations: `animate-fade-in`, `animate-in fade-in slide-in-from-top-2 duration-150`
- Badges: `text-[10px] px-1.5 py-0.5 rounded-full`

### Component Patterns
- All components use named exports, no default exports
- Imports from `@shared/*` via TS path alias
- Error states rendered inline (not thrown)
- Loading states use spinner: `w-5 h-5 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin`
- Feedback via temporary state + setTimeout (e.g., "Copied!", "Saved!")
- Export buttons show checkmark feedback on success

---

## 📡 The Communication Room — Messaging

### Background Messages (`src/shared/messages.ts`)
Typed message system for `chrome.runtime.sendMessage`:

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `START_RECORDING` | Popup → BG | Start recording on a tab |
| `STOP_RECORDING` | Popup → BG | Stop active recording |
| `PAUSE_RECORDING` | Popup → BG | Pause active recording |
| `RESUME_RECORDING` | Popup → BG | Resume paused recording |
| `GET_STATUS` | Any → BG | Get current recording state |
| `ADD_NOTE` | Sidepanel → BG | Add a note to active recording |
| `PLATFORM_DETECTED` | Content → BG | Meeting platform identified |
| `USER_NAME_DETECTED` | Content → BG | User's name identified |
| `SPEAKER_ACTIVE` | Content → BG | A speaker started talking |

### Broadcast Events
| Event | Description |
|-------|-------------|
| `RECORDING_STARTED` | Broadcast when recording begins |
| `RECORDING_STOPPED` | Broadcast when recording ends |
| `RECORDING_PAUSED` | Broadcast on pause |
| `RECORDING_RESUMED` | Broadcast on resume |

---

## 🧭 The Compass — Key Conventions

### Naming
- **Files**: `kebab-case.ts` / `kebab-case.tsx` / `PascalCase.tsx` for components only
- **Functions**: `camelCase` — `export function useRecording()`, `function formatTime()`
- **Types**: `PascalCase` — `RecordingMeta`, `TranscriptionSegment`
- **CSS classes**: Tailwind utility classes only (no custom CSS except permissions page)
- **Imports**: `@shared/*` path alias for shared code; relative for same-directory

### Code Style
- `noUncheckedIndexedAccess`: always use `!` or optional chaining when accessing arrays
- No `any` types except for `(window as any)` shim access
- No `default` exports — always named exports
- React: functional components, hooks, `useCallback`/`useMemo` where beneficial
- No inline comments in production code unless explaining non-obvious logic

### State Management
- TanStack Query (`useQuery`/`useMutation`) for all async data
- `useState` for local UI state (modals, feedback messages)
- `useRef` for media streams, timers, and mutable recording state
- QueryClient invalidation on mutations

---

## 🗺️ The Atlas — Recent Work (Last Commit)

```
feat: add delete confirmation dialog, SRT/VTT export, styled permissions,
shared utilities, and doc updates

- ConfirmDialog component replacing window.confirm for recording deletion
- SRT/VTT subtitle export formats in export pipeline
- Styled permissions page with brand dark theme
- Shared format.ts module consolidating 7 duplicated formatter functions
- Full documentation updates across all 3 README files
```

### Key New Files
| File | Lines | Purpose |
|------|-------|---------|
| `src/shared/format.ts` | 59 | `formatTime`, `formatTimestamp`, `formatDuration`, `formatClock`, `escapeHtml`, `renderMarkdown` |
| `src/shared/confirm-dialog.tsx` | 80 | Modal dialog with Escape/backdrop dismiss, danger/default variants |
| `src/shared/error-boundary.tsx` | ~50 | React error boundary for app roots |

---

## 🔧 The Tool Shed — Common Tasks

### Adding a new export format
1. Add export function to `src/shared/api/export.ts` (e.g., `exportAsPDF`)
2. Add menu item to `src/sidepanel/components/ExportMenu.tsx`
3. Optionally re-export from `ExportMenu` if used in the desktop app

### Adding a new AI provider
1. Add provider ID to `Provider` type in `src/shared/types.ts`
2. Add config to `src/shared/api/providers.ts` (models, capabilities, API endpoint)
3. Add UI to `src/sidepanel/routes/settings.tsx`
4. Add key field in `Settings` type

### Adding a new shared utility
1. Add function to `src/shared/format.ts` if it's formatting
2. Create a new file in `src/shared/` if it's a component or logic module
3. Update `DEVELOPMENT.md` shared utilities table

### Building for release
```bash
# Extension
npm run build

# Desktop (Linux)
cd electron-app && npm run build:deb

# Desktop (AppImage) 
cd electron-app && npm run build:appimage

# Desktop (all Linux)
cd electron-app && npm run build:linux
```

---

## ❗ The Watchtower — Known Issues

- `electron-app/src/hooks/useDesktopRecorder.ts` has 3 pre-existing TS errors (`TS2349`) from optional chaining interactions with strict type checking — unrelated to shared code changes
- `noUncheckedIndexedAccess` requires careful array access (use `!` or optional chaining)
- Desktop speaker detection less mature than extension DOM-based detection
- `tsconfig.tsbuildinfo` often shows as modified — safe to commit

---

## 🔐 The Vault — Environment & Secrets

- No `.env` files in the repo
- API keys entered via Settings page, stored in `chrome.storage.local`
- Local AI runs entirely in WASM/ONNX — no data leaves the device
- Desktop app uses `chrome-shim.ts` to emulate `chrome.storage` via Electron IPC
- Electron preload script (`electron/preload.ts`) exposes secure IPC bridge

---

## 🌐 The Observatory — Dependencies

### Core Runtime
- React 19, React DOM 19
- TanStack React Query 5, TanStack React Router 1
- `lucide-react` for icons

### AI
- `@huggingface/transformers` 3.8+ — WASM/ONNX model inference
- ONNX Runtime Web (bundled with transformers.js)

### Build
- Vite 5 + `vite-plugin-electron` + `vite-plugin-electron-renderer`
- Tailwind CSS v4 + PostCSS
- TypeScript 5
- Electron 33 + electron-builder 24

---

*End of Memory Palace. AI agents arriving fresh should read this file top-to-bottom to rebuild full context. Return here when lost.*
