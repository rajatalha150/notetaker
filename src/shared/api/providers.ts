import { getSettings } from "../storage/settings";
import type { Transcription, TranscriptionSegment } from "../types";

const GPT4O_MODELS = ["gpt-4o-transcribe", "gpt-4o-mini-transcribe"];

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} minutes`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

async function decodeAudioChannels(blob: Blob): Promise<{
  mono: Float32Array;
  left: Float32Array | null;
  right: Float32Array | null;
  sampleRate: number;
}> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new window.AudioContext({ sampleRate: 16000 });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const left = audioBuffer.getChannelData(0);
  let right: Float32Array | null = null;
  let mono: Float32Array;

  if (audioBuffer.numberOfChannels >= 2) {
    right = audioBuffer.getChannelData(1);

    // Check if channels are actually different (stereo separation was applied)
    let diffSum = 0;
    const step = 100; // sample every 100th sample for speed
    for (let i = 0; i < left.length; i += step) {
      const d = left[i]! - (right[i] ?? 0);
      diffSum += d * d;
    }
    const diffRms = Math.sqrt(diffSum / (left.length / step));

    if (diffRms < 0.0005) {
      // Channels are effectively identical — no stereo separation
      right = null;
      mono = left;
    } else {
      // Create mono mix for single-pass Whisper
      mono = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        mono[i] = (left[i]! + right[i]!) * 0.5;
      }
    }
  } else {
    mono = left;
  }

  await audioContext.close();
  return { mono, left: audioBuffer.numberOfChannels >= 2 ? left : null, right, sampleRate: 16000 };
}

/**
 * Compute per-segment speaker labels from stereo channel energy.
 * Left = "You" (mic), Right = "Others" (system audio).
 * Returns a speaker label for each segment based on which channel is dominant.
 */
function assignSpeakersFromChannels(
  segments: { start: number; end: number; text: string }[],
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  userName?: string,
  otherName?: string,
): { start: number; end: number; text: string; speaker: string }[] {
  return segments.map((seg) => {
    const startSample = Math.floor(seg.start * sampleRate);
    const endSample = Math.min(Math.floor(seg.end * sampleRate), left.length);

    if (endSample <= startSample) {
      return { ...seg, speaker: otherName || "Speaker 2" };
    }

    let leftEnergy = 0;
    let rightEnergy = 0;
    const step = Math.max(1, Math.floor((endSample - startSample) / 500)); // sample up to 500 points

    for (let i = startSample; i < endSample; i += step) {
      leftEnergy += left[i]! * left[i]!;
      rightEnergy += right[i]! * right[i]!;
    }

    const totalEnergy = leftEnergy + rightEnergy;
    if (totalEnergy < 1e-8) {
      // Silence segment
      return { ...seg, speaker: otherName || "Speaker 2" };
    }

    const leftRatio = leftEnergy / totalEnergy;

    // Left channel > 60% energy → mic (You)
    // Right channel > 60% energy → system (Others)
    // Otherwise → whoever is louder, with a slight bias toward system audio
    // since in most calls the other person talks more
    if (leftRatio > 0.6) {
      return { ...seg, speaker: userName || "You" };
    } else if (leftRatio < 0.4) {
      return { ...seg, speaker: otherName || "Speaker 2" };
    } else {
      // Ambiguous — assign to whichever is slightly louder
      return { ...seg, speaker: leftRatio >= 0.5 ? (userName || "You") : (otherName || "Speaker 2") };
    }
  });
}

/**
 * Merge speakerEvents from recording metadata into transcription segments.
 * SpeakerEvents are timestamped labels like { name: "John", timestamp: 45000 }.
 * For each segment, find the most recent speaker event that precedes it.
 */
export function mergeSpeakerEvents(
  segments: { start: number; end: number; text: string; speaker?: string }[],
  speakerEvents: { name: string; timestamp: number }[],
): { start: number; end: number; text: string; speaker?: string }[] {
  if (!speakerEvents.length) return segments;

  // Sort events by timestamp
  const sorted = [...speakerEvents].sort((a, b) => a.timestamp - b.timestamp);

  return segments.map((seg) => {
    // Segment start is in seconds, speakerEvents timestamps are in ms
    const segStartMs = seg.start * 1000;

    // Find the most recent speaker event before or at this segment
    let bestEvent = sorted[0];
    for (const event of sorted) {
      if (event.timestamp <= segStartMs + 2000) {
        bestEvent = event;
      } else {
        break;
      }
    }

    if (bestEvent && Math.abs(bestEvent.timestamp - segStartMs) < 10000) {
      return { ...seg, speaker: bestEvent.name };
    }

    return seg;
  });
}

// ── Transcription ──

async function transcribeOpenAI(audioBlob: Blob, model: string, apiKey: string): Promise<Transcription> {
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
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI transcription error: ${res.status} ${err}`);
  }

  const data = await res.json();

  if (isGpt4o) {
    return {
      fullText: data.text,
      language: data.language,
      segments: data.logprobs
        ? data.logprobs
          .map((lp: { token: string; offset: number }, i: number, arr: { offset: number }[]) => ({
            start: lp.offset ?? 0,
            end: arr[i + 1]?.offset ?? lp.offset ?? 0,
            text: lp.token?.trim() ?? "",
          }))
          .filter((s: { text: string }) => s.text.length > 0)
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

async function transcribeGroq(audioBlob: Blob, model: string, apiKey: string): Promise<Transcription> {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", model);
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq transcription error: ${res.status} ${err}`);
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

// @ts-expect-error Vite worker import
import TranscribeWorker from "./transcribeWorker?worker";
let localWorker: Worker | null = null;

/**
 * Transcribe locally using a SINGLE Whisper pass on mono audio,
 * then assign speakers via stereo channel energy analysis.
 * This is ~2x faster than the old approach of running Whisper twice.
 */
async function transcribeLocal(audioBlob: Blob, model: string, hasMic?: boolean): Promise<Transcription> {
  const { mono, left, right, sampleRate } = await decodeAudioChannels(audioBlob);

  if (!localWorker) {
    localWorker = new TranscribeWorker();
  }

  // Single Whisper pass on mono audio
  const result = await new Promise<{ fullText: string; segments: any[] }>((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "done") {
        localWorker!.removeEventListener("message", handler);
        const { result } = msg;

        const fullText = (result.text || "").trim();
        const segments = (result.chunks || []).map((c: any) => ({
          start: c.timestamp?.[0] ?? 0,
          end: c.timestamp?.[1] ?? ((c.timestamp?.[0] ?? 0) + 5),
          text: (c.text || "").trim(),
        }));

        resolve({ fullText, segments });
      } else if (msg.type === "error") {
        localWorker!.removeEventListener("message", handler);
        reject(new Error(msg.error));
      }
    };

    localWorker!.addEventListener("message", handler);
    localWorker!.postMessage({ type: "transcribe", audio: mono, model });
  });

  let finalSegments = result.segments;

  // If we have stereo data AND we know a microphone was captured, assign speakers from channel energy
  if (left && right && hasMic) {
    finalSegments = assignSpeakersFromChannels(
      finalSegments,
      left,
      right,
      sampleRate,
    );
  }

  return {
    fullText: result.fullText,
    segments: finalSegments,
  };
}

async function transcribeDeepgram(audioBlob: Blob, model: string, apiKey: string): Promise<Transcription> {
  const res = await fetch(`https://api.deepgram.com/v1/listen?model=${model}&smart_format=true&diarize=true`, {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": "audio/webm" },
    body: audioBlob,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Deepgram API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.results?.channels[0]?.alternatives[0]?.transcript || "";
  const words = data.results?.channels[0]?.alternatives[0]?.words || [];

  return {
    fullText: text,
    segments: words.map((w: any) => ({
      start: w.start,
      end: w.end,
      text: w.punctuated_word || w.word,
      speaker: w.speaker !== undefined ? `Speaker ${w.speaker}` : undefined,
    })),
  };
}

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onload = () => {
    if (typeof reader.result === "string") {
      resolve(reader.result.split(",")[1] ?? "");
    } else {
      reject(new Error("Failed to read blob as string"));
    }
  };
  reader.onerror = error => reject(error);
});

async function transcribeGemini(audioBlob: Blob, model: string, apiKey: string): Promise<Transcription> {
  const base64Audio = await blobToBase64(audioBlob);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Transcribe the following audio accurately. Reply ONLY with the raw transcript." },
              { inlineData: { mimeType: "audio/webm", data: base64Audio } }
            ]
          }
        ]
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini transcription error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return {
    fullText: text,
    segments: [{ start: 0, end: 0, text }]
  };
}

export async function transcribe(audioBlob: Blob, hasMic?: boolean): Promise<Transcription> {
  const settings = await getSettings();
  const provider = settings.transcriptionProvider;
  const model = settings.transcriptionModel;
  const apiKey = settings.providers[provider];

  if (provider !== "local" && !apiKey) throw new Error(`${provider} API key not set`);

  switch (provider) {
    case "local":
      return transcribeLocal(audioBlob, model, hasMic);
    case "openai":
      return transcribeOpenAI(audioBlob, model, apiKey!);
    case "groq":
      return transcribeGroq(audioBlob, model, apiKey!);
    case "deepgram":
      return transcribeDeepgram(audioBlob, model, apiKey!);
    case "gemini":
      return transcribeGemini(audioBlob, model, apiKey!);
    default:
      throw new Error(`${provider} does not support transcription`);
  }
}

// ── Chat Completion ──

async function chatOpenAI(prompt: string, model: string, apiKey: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

async function chatAnthropic(prompt: string, model: string, apiKey: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

async function chatGemini(prompt: string, model: string, apiKey: string, maxTokens: number): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

async function chatGroq(prompt: string, model: string, apiKey: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

async function chatTogether(prompt: string, model: string, apiKey: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Together API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// @ts-expect-error Vite worker import
import ChatWorker from "./chatWorker?worker";
let localChatWorker: Worker | null = null;

// TinyLlama and small models have limited context — truncate prompt to fit
function truncatePromptForContext(prompt: string, maxChars: number): string {
  if (prompt.length <= maxChars) return prompt;
  // Keep the beginning (instructions) and end (most recent context) of the prompt
  const keepStart = Math.floor(maxChars * 0.3);
  const keepEnd = Math.floor(maxChars * 0.7);
  return prompt.slice(0, keepStart) + "\n\n[...transcript truncated for model context limit...]\n\n" + prompt.slice(prompt.length - keepEnd);
}

async function chatLocal(prompt: string, model: string, maxTokens: number): Promise<string> {
  if (!localChatWorker) {
    localChatWorker = new ChatWorker();
  }

  // TinyLlama 1.1B has ~2048 token context. Rough estimate: 1 token ≈ 4 chars.
  // Reserve ~1024 tokens for output, leaving ~1024 for prompt ≈ 4096 chars.
  const isTinyLlama = model.toLowerCase().includes("tinyllama");
  const maxPromptChars = isTinyLlama ? 4096 : 8192;
  const safePrompt = truncatePromptForContext(prompt, maxPromptChars);

  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "done") {
        localChatWorker!.removeEventListener("message", handler);
        resolve(msg.result);
      } else if (msg.type === "error") {
        localChatWorker!.removeEventListener("message", handler);
        reject(new Error(msg.error));
      }
      // status and progress events are intentionally ignored here;
      // they're consumed by the UI via the preload path
    };

    localChatWorker!.addEventListener("message", handler);
    // Format messages as HuggingFace chat template expects
    const systemPrompt = isTinyLlama
      ? "You are a concise meeting assistant. Summarize the transcript into clear, structured markdown with sections: Overview, Key Points, Decisions, Action Items, Follow-ups. Be brief."
      : "You are a helpful assistant that summarizes meeting transcripts clearly and concisely in markdown.";

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: safePrompt }
    ];
    localChatWorker!.postMessage({ type: "chat", messages, model, maxTokens });
  });
}

async function chatCompletion(prompt: string, maxTokens = 2048): Promise<string> {
  const settings = await getSettings();
  const provider = settings.summarizationProvider;
  const model = settings.summarizationModel;
  const apiKey = settings.providers[provider];

  if (provider !== "local" && !apiKey) throw new Error(`${provider} API key not set`);

  switch (provider) {
    case "local":
      return chatLocal(prompt, model, maxTokens);
    case "openai":
      return chatOpenAI(prompt, model, apiKey!, maxTokens);
    case "anthropic":
      return chatAnthropic(prompt, model, apiKey!, maxTokens);
    case "gemini":
      return chatGemini(prompt, model, apiKey!, maxTokens);
    case "groq":
      return chatGroq(prompt, model, apiKey!, maxTokens);
    case "together":
      return chatTogether(prompt, model, apiKey!, maxTokens);
    default:
      throw new Error(`${provider} does not support summarization`);
  }
}

// ── High-level functions ──

export async function diarizeSpeakers(
  segments: TranscriptionSegment[],
  userName?: string,
  speakerEvents?: any[],
  participantNames?: string[]
): Promise<TranscriptionSegment[]> {
  if (segments.length === 0) return segments;

  const namesList = [
    ...(userName ? [userName] : []),
    ...(participantNames ?? []),
    ...(speakerEvents ? Array.from(new Set(speakerEvents.map(e => e.name))) : [])
  ].join(", ");

  const contextPrompt = namesList 
    ? `The following people were detected in the call: ${namesList}. Use these actual names for labels instead of generic ones whenever possible.`
    : `Assign labels like "Speaker A", "Speaker B", etc.`;

  const transcript = segments
    .map((s, i) => `[${i}] [${formatTimestamp(s.start)}] ${s.text}`)
    .join("\n");

  const text = await chatCompletion(
    `Analyze this transcript and identify distinct speakers based on conversational cues (questions vs answers, topic shifts, style differences). Use names from the detected list if they match.
${contextPrompt}

Return ONLY a JSON array of speaker labels, one per segment index. Example: ["Speaker A", "Speaker B", "Speaker A"]

Transcript:
${transcript}`,
    1024
  );

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return segments;
    const array = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(array)) return segments;

    const labels = array.map((item: any) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return item.speaker || item.label || item.name || item.value || JSON.stringify(item);
      }
      return String(item) || "Unknown";
    });

    return segments.map((seg, i) => {
      let speaker = labels[i] ?? seg.speaker;
      
      // Post-process "You" mapping if AI returned "You" but we have useName
      if (speaker === "You" && userName) speaker = userName;

      // If AI didn't find a name but we have a log event at this exact time, use it
      if ((!speaker || speaker.startsWith("Speaker")) && speakerEvents) {
        const event = speakerEvents.find(e => Math.abs(e.timestamp - seg.start) < 3000);
        if (event) speaker = event.name;
      }

      return { ...seg, speaker };
    });
  } catch {
    return segments;
  }
}

export async function summarizeTranscript(
  transcription: Transcription,
  notes: string[],
  meta?: { duration?: number; platform?: string }
): Promise<string> {
  const metaLines: string[] = [];
  if (meta?.duration) metaLines.push(`Duration: ${formatDuration(meta.duration)}`);
  if (meta?.platform) metaLines.push(`Platform: ${meta.platform}`);
  const metaSection = metaLines.length > 0 ? `Meeting metadata:\n${metaLines.join("\n")}\n\n` : "";

  const transcript = transcription.segments
    .map((s) => {
      const time = formatTimestamp(s.start);
      const speaker = s.speaker ? `${s.speaker}: ` : "";
      return `[${time}] ${speaker}${s.text}`;
    })
    .join("\n");

  const notesSection =
    notes.length > 0
      ? `\n\nManual notes taken during the call:\n${notes.map((n) => `- ${n}`).join("\n")}`
      : "";

  const prompt = `You are summarizing a meeting transcript. Provide a structured summary in markdown format.

${metaSection}Transcript:
${transcript}${notesSection}

Please provide the summary with these sections:
## Overview
A brief 2-3 sentence overview of the meeting.

## Key Discussion Points
Bullet points of the main topics discussed.

## Decisions Made
Any decisions that were reached during the meeting.

## Action Items
List action items${transcription.segments.some((s) => s.speaker) ? ", attributed to the relevant speaker where possible" : ""}.

## Follow-ups
Any items that need follow-up or were left unresolved.`;

  return chatCompletion(prompt);
}
