import type { Settings } from "../types";
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

function migrate(raw: LegacySettings & Partial<Settings>): Settings {
  // Already migrated
  if (raw.providers) return { ...DEFAULT_SETTINGS, ...raw } as Settings;

  // Migrate from legacy flat keys
  return {
    providers: {
      openai: raw.whisperApiKey || undefined,
      anthropic: raw.claudeApiKey || undefined,
    },
    providersEnabled: {},
    transcriptionProvider: "openai",
    transcriptionModel: raw.whisperModel || DEFAULT_SETTINGS.transcriptionModel,
    summarizationProvider: "anthropic",
    summarizationModel: raw.claudeModel || DEFAULT_SETTINGS.summarizationModel,
    audioFormat: raw.audioFormat || DEFAULT_SETTINGS.audioFormat,
    captureMic: raw.captureMic ?? DEFAULT_SETTINGS.captureMic,
  };
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(KEY);
  const raw = result[KEY];
  if (!raw) return DEFAULT_SETTINGS;
  return migrate(raw);
}

export async function saveSettings(settings: Partial<Settings>) {
  const current = await getSettings();
  await chrome.storage.local.set({ [KEY]: { ...current, ...settings } });
}
