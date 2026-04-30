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
  sourceWindowTitle?: string;
  sourceWindowClass?: string;
  sourceProcessName?: string;
  mimeType?: string;
  captureMic?: boolean;
  userName?: string; // The name of "You"
  participantNames?: string[];
  detectedParticipantNames?: string[];
  participantDetectionMethod?: "source-title" | "window-metadata" | "native-ui";
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
  transcriptionModel: "onnx-community/whisper-tiny",
  summarizationProvider: "local",
  summarizationModel: "onnx-community/Qwen2.5-0.5B-Instruct",
  enableCloudProviders: false,
  audioFormat: "webm",
  captureMic: true,
};
