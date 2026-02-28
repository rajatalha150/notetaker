import { getSettings } from "../storage/settings";

export async function summarizeTranscript(
  transcript: string,
  notes: string[]
): Promise<string> {
  const settings = await getSettings();
  if (!settings.claudeApiKey) throw new Error("Claude API key not set");

  const notesSection =
    notes.length > 0
      ? `\n\nManual notes taken during the call:\n${notes.map((n) => `- ${n}`).join("\n")}`
      : "";

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
      messages: [
        {
          role: "user",
          content: `Summarize this call transcript concisely. Include key decisions, action items, and important points.${notesSection}\n\nTranscript:\n${transcript}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
}
