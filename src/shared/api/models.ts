import type { Provider } from "../types";

export interface ModelOption {
  id: string;
  label: string;
  provider: Provider;
  capabilities: ("transcription" | "chat")[];
}

export const MODELS: ModelOption[] = [
  // Local In-Browser
  { id: "Xenova/whisper-tiny.en", label: "Whisper Tiny (Local Browser - Very Fast)", provider: "local", capabilities: ["transcription"] },
  { id: "Xenova/whisper-base.en", label: "Whisper Base (Local Browser - Balanced)", provider: "local", capabilities: ["transcription"] },
  { id: "Xenova/whisper-small.en", label: "Whisper Small (Local Browser - Accurate)", provider: "local", capabilities: ["transcription"] },
  // OpenAI - transcription
  { id: "whisper-1", label: "Whisper", provider: "openai", capabilities: ["transcription"] },
  { id: "gpt-4o-transcribe", label: "GPT-4o Transcribe", provider: "openai", capabilities: ["transcription"] },
  { id: "gpt-4o-mini-transcribe", label: "GPT-4o Mini Transcribe", provider: "openai", capabilities: ["transcription"] },
  // OpenAI - chat
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", capabilities: ["chat"] },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", capabilities: ["chat"] },

  // Anthropic - chat only
  { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet (Latest)", provider: "anthropic", capabilities: ["chat"] },
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", provider: "anthropic", capabilities: ["chat"] },
  { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", provider: "anthropic", capabilities: ["chat"] },
  { id: "claude-3-opus-20240229", label: "Claude 3 Opus", provider: "anthropic", capabilities: ["chat"] },

  // Gemini - chat only
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", capabilities: ["chat"] },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", capabilities: ["chat"] },
  { id: "gemini-2.0-pro-exp-0205", label: "Gemini 2.0 Pro Experimental", provider: "gemini", capabilities: ["chat"] },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "gemini", capabilities: ["chat"] },
  { id: "gemini-2.0-flash-lite-preview-02-05", label: "Gemini 2.0 Flash Lite", provider: "gemini", capabilities: ["chat"] },

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
