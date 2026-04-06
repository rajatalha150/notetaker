import type { Provider } from "../types";

export interface ModelOption {
  id: string;
  label: string;
  provider: Provider;
  capabilities: ("transcription" | "chat")[];
  /** Approximate download size in MB (local models only) */
  sizeMB?: number;
  /** Short description shown in the settings UI */
  description?: string;
  /** Whether this is the recommended default */
  isRecommended?: boolean;
  /** Grouping tier for local chat models: 'ultra-light' | 'standard' */
  tier?: "ultra-light" | "standard";
}

export const MODELS: ModelOption[] = [
  // Local In-Browser (Transcription) — multilingual Whisper via onnx-community
  {
    id: "onnx-community/whisper-tiny",
    label: "Whisper Tiny",
    provider: "local",
    capabilities: ["transcription"],
    sizeMB: 39,
    description: "Very fast, decent accuracy. Multilingual. Best for quick previews.",
    isRecommended: true,
  },
  {
    id: "onnx-community/whisper-base",
    label: "Whisper Base",
    provider: "local",
    capabilities: ["transcription"],
    sizeMB: 100,
    description: "Better accuracy than Tiny. Still browser-friendly. Good balance.",
  },
  {
    id: "onnx-community/whisper-small",
    label: "Whisper Small",
    provider: "local",
    capabilities: ["transcription"],
    sizeMB: 460,
    description: "Best quality under 500MB. Ideal for important recordings.",
  },

  // ── Local In-Browser (Chat / Summary) ──────────────────────────────────
  // Ultra-light tier: fastest, trades quality for speed
  {
    // SmolLM2-360M: ~180MB Q4, Apache 2.0. Fastest option.
    id: "HuggingFaceTB/SmolLM2-360M-Instruct",
    label: "SmolLM2 360M",
    provider: "local",
    capabilities: ["chat"],
    sizeMB: 180,
    description: "Fastest local model. Lower quality, but instant on most hardware. Best for quick notes.",
    tier: "ultra-light",
  },
  {
    // Qwen2.5-0.5B: best tiny LLM for browser. Recommended for ultra-light tier.
    id: "onnx-community/Qwen2.5-0.5B-Instruct",
    label: "Qwen 2.5 0.5B",
    provider: "local",
    capabilities: ["chat"],
    sizeMB: 350,
    description: "Best tiny LLM for browser use. Great reasoning per MB. Go-to for constrained devices.",
    isRecommended: true,
    tier: "ultra-light",
  },
  // Standard tier: quality-focused (400–500MB)
  {
    // SmolLM2-1.7B: Apache 2.0, open access
    id: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
    label: "SmolLM2 1.7B",
    provider: "local",
    capabilities: ["chat"],
    sizeMB: 450,
    description: "Better summarization quality. Needs more RAM but noticeably smarter output.",
    tier: "standard",
  },
  {
    // Note: use Xenova namespace — onnx-community/TinyLlama is gated
    id: "Xenova/TinyLlama-1.1B-Chat-v1.0",
    label: "TinyLlama 1.1B",
    provider: "local",
    capabilities: ["chat"],
    sizeMB: 400,
    description: "Stable and battle-tested. Slightly weaker reasoning than Qwen but proven in browser.",
    tier: "standard",
  },
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

  // Gemini - chat AND transcription!
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", capabilities: ["chat", "transcription"] },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", capabilities: ["chat", "transcription"] },
  { id: "gemini-2.0-pro-exp-0205", label: "Gemini 2.0 Pro Experimental", provider: "gemini", capabilities: ["chat", "transcription"] },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "gemini", capabilities: ["chat", "transcription"] },
  { id: "gemini-2.0-flash-lite-preview-02-05", label: "Gemini 2.0 Flash Lite", provider: "gemini", capabilities: ["chat", "transcription"] },

  // Groq - transcription
  { id: "whisper-large-v3", label: "Whisper Large v3", provider: "groq", capabilities: ["transcription"] },
  { id: "whisper-large-v3-turbo", label: "Whisper Large v3 Turbo", provider: "groq", capabilities: ["transcription"] },
  { id: "distil-whisper-large-v3-en", label: "Distil Whisper Large v3", provider: "groq", capabilities: ["transcription"] },
  // Groq - chat
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "groq", capabilities: ["chat"] },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", provider: "groq", capabilities: ["chat"] },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", provider: "groq", capabilities: ["chat"] },

  // Deepgram - transcription
  { id: "nova-2", label: "Nova 2 (Fastest & Accurate)", provider: "deepgram", capabilities: ["transcription"] },
  { id: "nova-3", label: "Nova 3 (Experimental)", provider: "deepgram", capabilities: ["transcription"] },

  // Together AI - open source chat
  { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo", provider: "together", capabilities: ["chat"] },
  { id: "deepseek-ai/DeepSeek-V3", label: "DeepSeek V3", provider: "together", capabilities: ["chat"] },
  { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", label: "Qwen 2.5 72B", provider: "together", capabilities: ["chat"] },
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
