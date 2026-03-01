import { getSettings } from "../storage/settings";
import type { Transcription, TranscriptionSegment } from "../types";

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

export async function diarizeSpeakers(
  segments: TranscriptionSegment[]
): Promise<TranscriptionSegment[]> {
  const settings = await getSettings();
  if (!settings.claudeApiKey) throw new Error("Claude API key not set");
  if (segments.length === 0) return segments;

  const transcript = segments
    .map((s, i) => `[${i}] [${formatTimestamp(s.start)}] ${s.text}`)
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.claudeApiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: settings.claudeModel,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analyze this transcript and identify distinct speakers based on conversational cues (questions vs answers, topic shifts, style differences). Assign labels like "Speaker A", "Speaker B", etc.

Return ONLY a JSON array of speaker labels, one per segment index. Example: ["Speaker A", "Speaker B", "Speaker A"]

Transcript:
${transcript}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text: string = data.content[0].text;

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return segments;
    const labels: string[] = JSON.parse(jsonMatch[0]);
    return segments.map((seg, i) => ({
      ...seg,
      speaker: labels[i] ?? seg.speaker,
    }));
  } catch {
    return segments;
  }
}

export async function summarizeTranscript(
  transcription: Transcription,
  notes: string[],
  meta?: { duration?: number; platform?: string }
): Promise<string> {
  const settings = await getSettings();
  if (!settings.claudeApiKey) throw new Error("Claude API key not set");

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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.claudeApiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: settings.claudeModel,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}
