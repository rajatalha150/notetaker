import type { Transcription } from "../types";
import { getSettings } from "../storage/settings";

export async function transcribeAudio(audioBlob: Blob): Promise<Transcription> {
  const settings = await getSettings();
  if (!settings.whisperApiKey) throw new Error("Whisper API key not set");

  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", settings.whisperModel);
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${settings.whisperApiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper API error: ${res.status} ${err}`);
  }

  const data = await res.json();

  return {
    fullText: data.text,
    language: data.language,
    segments: (data.segments ?? []).map((s: { start: number; end: number; text: string }) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    })),
  };
}
