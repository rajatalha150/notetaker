import type { Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

const KEY = "settings";

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(result[KEY] as Partial<Settings> | undefined) };
}

export async function saveSettings(settings: Partial<Settings>) {
  const current = await getSettings();
  await chrome.storage.local.set({ [KEY]: { ...current, ...settings } });
}
