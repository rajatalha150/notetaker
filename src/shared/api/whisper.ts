import type { Transcription } from "../types";
import { getSettings } from "../storage/settings";

const GPT4O_MODELS = ["gpt-4o-transcribe", "gpt-4o-mini-transcribe"];

export async function transcribeAudio(audioBlob: Blob): Promise<Transcription> {
  const settings = await getSettings();
  if (!settings.whisperApiKey) throw new Error("Whisper API key not set");

  const model = settings.whisperModel;
  const isGpt4o = GPT4O_MODELS.includes(model);

  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", model);

  if (isGpt4o) {
    formData.append("response_format", "json");
    formData.append("include[]", "logprobs");
  } else {
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "segment");
  }

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

  if (isGpt4o) {
    // GPT-4o transcribe models return a different format
    return {
      fullText: data.text,
      language: data.language,
      segments: data.logprobs
        ? data.logprobs.map((lp: { token: string; offset: number }, i: number, arr: { offset: number }[]) => ({
            start: lp.offset ?? 0,
            end: arr[i + 1]?.offset ?? lp.offset ?? 0,
            text: lp.token?.trim() ?? "",
          })).filter((s: { text: string }) => s.text.length > 0)
        : [{ start: 0, end: 0, text: data.text }],
    };
  }

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
