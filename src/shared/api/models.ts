export interface ModelOption {
  id: string;
  label: string;
  provider: "anthropic" | "openai";
}

export const SUMMARIZATION_MODELS: ModelOption[] = [
  { id: "claude-sonnet-4-6-20250220", label: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "claude-opus-4-6-20250515", label: "Claude Opus 4.6", provider: "anthropic" },
];

export const TRANSCRIPTION_MODELS: ModelOption[] = [
  { id: "whisper-1", label: "Whisper", provider: "openai" },
  { id: "gpt-4o-transcribe", label: "GPT-4o Transcribe", provider: "openai" },
  { id: "gpt-4o-mini-transcribe", label: "GPT-4o Mini Transcribe", provider: "openai" },
];
