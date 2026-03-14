export type RecordingStatus = "idle" | "recording" | "paused" | "stopped";

export interface RecordingMeta {
  id: string;
  title: string;
  startedAt: number;
  stoppedAt?: number;
  duration: number;
  status: RecordingStatus;
  environment?: "extension" | "desktop";
  platform?: string;
  notes: Note[];
  transcription?: Transcription;
  summary?: string;
  downloadId?: number;
  filename?: string;
  filePath?: string;
  fileSize?: number;
  sourceId?: string;
  sourceName?: string;
  mimeType?: string;
  userName?: string; // The name of "You"
  speakerEvents?: SpeakerEvent[]; // Log of who spoke when
}

export interface SpeakerEvent {
  name: string;
  timestamp: number; // ms offset from recording start
}

export interface Note {
  id: string;
  text: string;
  timestamp: number; // ms offset from recording start
  createdAt: number;
}

export interface Transcription {
  segments: TranscriptionSegment[];
  fullText: string;
  language?: string;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export type Provider = "openai" | "anthropic" | "gemini" | "groq" | "together" | "deepgram" | "local";

export interface Settings {
  providers: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
    groq?: string;
    together?: string;
    deepgram?: string;
    local?: string;
  };
  providersEnabled: {
    openai?: boolean;
    anthropic?: boolean;
    gemini?: boolean;
    groq?: boolean;
    together?: boolean;
    deepgram?: boolean;
  };
  transcriptionProvider: Provider;
  transcriptionModel: string;
  summarizationProvider: Provider;
  summarizationModel: string;
  enableCloudProviders: boolean;
  audioFormat: "webm" | "ogg";
  captureMic: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  providers: {},
  providersEnabled: {},
  transcriptionProvider: "local",
  transcriptionModel: "Xenova/whisper-tiny.en",
  summarizationProvider: "local",
  summarizationModel: "Xenova/Qwen1.5-0.5B-Chat",
  enableCloudProviders: false,
  audioFormat: "webm",
  captureMic: true,
};
