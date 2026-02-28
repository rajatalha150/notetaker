import type { RecordingMeta } from "../types";

const STORAGE_KEY = "recordings";

export async function getAllRecordings(): Promise<RecordingMeta[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as RecordingMeta[]) ?? [];
}

export async function getRecording(id: string): Promise<RecordingMeta | undefined> {
  const all = await getAllRecordings();
  return all.find((r) => r.id === id);
}

export async function saveRecording(meta: RecordingMeta) {
  const all = await getAllRecordings();
  const idx = all.findIndex((r) => r.id === meta.id);
  if (idx >= 0) {
    all[idx] = meta;
  } else {
    all.unshift(meta);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: all });
}

export async function deleteRecording(id: string) {
  const all = await getAllRecordings();
  await chrome.storage.local.set({
    [STORAGE_KEY]: all.filter((r) => r.id !== id),
  });
}
