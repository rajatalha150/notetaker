import type { Provider } from "../types";

export interface ModelOption {
  id: string;
  label: string;
  provider: Provider;
  capabilities: ("transcription" | "chat")[];
}

export const MODELS: ModelOption[] = [
  // OpenAI - transcription
  { id: "whisper-1", label: "Whisper", provider: "openai", capabilities: ["transcription"] },
  { id: "gpt-4o-transcribe", label: "GPT-4o Transcribe", provider: "openai", capabilities: ["transcription"] },
  { id: "gpt-4o-mini-transcribe", label: "GPT-4o Mini Transcribe", provider: "openai", capabilities: ["transcription"] },
  // OpenAI - chat
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", capabilities: ["chat"] },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", capabilities: ["chat"] },

  // Anthropic - chat only
  { id: "claude-sonnet-4-6-20250220", label: "Claude Sonnet 4.6", provider: "anthropic", capabilities: ["chat"] },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic", capabilities: ["chat"] },
  { id: "claude-opus-4-6-20250515", label: "Claude Opus 4.6", provider: "anthropic", capabilities: ["chat"] },

  // Gemini - chat only
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "gemini", capabilities: ["chat"] },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", capabilities: ["chat"] },

  // Groq - transcription
  { id: "whisper-large-v3", label: "Whisper Large v3", provider: "groq", capabilities: ["transcription"] },
  { id: "whisper-large-v3-turbo", label: "Whisper Large v3 Turbo", provider: "groq", capabilities: ["transcription"] },
  { id: "distil-whisper-large-v3-en", label: "Distil Whisper Large v3", provider: "groq", capabilities: ["transcription"] },
  // Groq - chat
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "groq", capabilities: ["chat"] },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", provider: "groq", capabilities: ["chat"] },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", provider: "groq", capabilities: ["chat"] },
];

export function getTranscriptionModels(provider?: Provider): ModelOption[] {
  return MODELS.filter((m) => m.capabilities.includes("transcription") && (!provider || m.provider === provider));
}

export function getChatModels(provider?: Provider): ModelOption[] {
  return MODELS.filter((m) => m.capabilities.includes("chat") && (!provider || m.provider === provider));
}

export function getProvidersWithCapability(capability: "transcription" | "chat"): Provider[] {
  const providers = new Set(MODELS.filter((m) => m.capabilities.includes(capability)).map((m) => m.provider));
  return [...providers];
}
