import { getChatModels, getDefaultModel, getTranscriptionModels } from "../api/models";
import type { Provider, Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

const KEY = "settings";

interface LegacySettings {
  whisperApiKey?: string;
  claudeApiKey?: string;
  whisperModel?: string;
  claudeModel?: string;
  audioFormat?: "webm" | "ogg";
  captureMic?: boolean;
}

function isProviderConfigured(settings: Partial<Settings>, provider: Provider): boolean {
  if (provider === "local") return true;
  return !!settings.providers?.[provider] && settings.providersEnabled?.[provider] !== false;
}

function getAllowedProviders(
  settings: Partial<Settings>,
  capability: "transcription" | "chat"
): Provider[] {
  const providers: Provider[] = ["local"];

  if (!settings.enableCloudProviders) {
    return providers;
  }

  const cloudProviders: Provider[] = capability === "transcription"
    ? ["openai", "gemini", "groq", "deepgram"]
    : ["openai", "anthropic", "gemini", "groq", "together"];

  for (const provider of cloudProviders) {
    if (isProviderConfigured(settings, provider)) {
      providers.push(provider);
    }
  }

  return providers;
}

function normalizeProviderAndModel(
  settings: Partial<Settings>,
  capability: "transcription" | "chat",
  provider: Provider | undefined,
  model: string | undefined
): { provider: Provider; model: string } {
  const allowedProviders = getAllowedProviders(settings, capability);
  const fallbackProvider = allowedProviders[0] ?? "local";
  const requestedProvider = provider ?? "local";
  const safeProvider: Provider = allowedProviders.includes(requestedProvider)
    ? requestedProvider
    : fallbackProvider;
  const models = capability === "transcription"
    ? getTranscriptionModels(safeProvider)
    : getChatModels(safeProvider);
  const safeModel = models.some((item) => item.id === model)
    ? model!
    : (getDefaultModel(capability, safeProvider)?.id ?? models[0]?.id ?? "");

  return { provider: safeProvider, model: safeModel };
}

export function normalizeSettings(raw: Partial<Settings>): Settings {
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    providers: {
      ...DEFAULT_SETTINGS.providers,
      ...(raw.providers ?? {}),
    },
    providersEnabled: {
      ...DEFAULT_SETTINGS.providersEnabled,
      ...(raw.providersEnabled ?? {}),
    },
  };

  const transcription = normalizeProviderAndModel(
    merged,
    "transcription",
    merged.transcriptionProvider,
    merged.transcriptionModel
  );
  const summarization = normalizeProviderAndModel(
    merged,
    "chat",
    merged.summarizationProvider,
    merged.summarizationModel
  );

  return {
    ...merged,
    transcriptionProvider: transcription.provider,
    transcriptionModel: transcription.model,
    summarizationProvider: summarization.provider,
    summarizationModel: summarization.model,
  };
}

function migrate(raw: LegacySettings & Partial<Settings>): Settings {
  // Already migrated
  if (raw.providers) {
    const hasAnyKey = Object.values(raw.providers).some((v) => !!v);
    return normalizeSettings({
      ...raw,
      enableCloudProviders: raw.enableCloudProviders ?? hasAnyKey,
    });
  }

  const hasOpenAIKey = !!raw.whisperApiKey;
  const hasAnthropicKey = !!raw.claudeApiKey;

  // Migrate from legacy flat keys
  return normalizeSettings({
    providers: {
      openai: raw.whisperApiKey || undefined,
      anthropic: raw.claudeApiKey || undefined,
    },
    providersEnabled: {},
    transcriptionProvider: hasOpenAIKey ? "openai" : DEFAULT_SETTINGS.transcriptionProvider,
    transcriptionModel: raw.whisperModel || DEFAULT_SETTINGS.transcriptionModel,
    summarizationProvider: hasAnthropicKey
      ? "anthropic"
      : hasOpenAIKey
        ? "openai"
        : DEFAULT_SETTINGS.summarizationProvider,
    summarizationModel: raw.claudeModel || DEFAULT_SETTINGS.summarizationModel,
    enableCloudProviders: hasOpenAIKey || hasAnthropicKey,
    audioFormat: raw.audioFormat || DEFAULT_SETTINGS.audioFormat,
    captureMic: raw.captureMic ?? DEFAULT_SETTINGS.captureMic,
  });
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(KEY);
  const raw = result[KEY];
  if (!raw) return DEFAULT_SETTINGS;
  return migrate(raw);
}

export async function saveSettings(settings: Partial<Settings>) {
  const current = await getSettings();
  const next = normalizeSettings({
    ...current,
    ...settings,
    providers: {
      ...current.providers,
      ...(settings.providers ?? {}),
    },
    providersEnabled: {
      ...current.providersEnabled,
      ...(settings.providersEnabled ?? {}),
    },
  });
  await chrome.storage.local.set({ [KEY]: next });
}
