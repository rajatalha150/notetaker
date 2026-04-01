import type { RecordingMeta } from "../types";

// ── Formatting Helpers ──

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} minutes`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Export: Full Markdown Report ──

export function exportAsMarkdown(recording: RecordingMeta): string {
  const lines: string[] = [];

  lines.push(`# ${recording.title}`);
  lines.push("");
  lines.push(`**Date:** ${formatDate(recording.startedAt)}`);
  lines.push(`**Duration:** ${formatDuration(recording.duration)}`);
  if (recording.platform) lines.push(`**Platform:** ${recording.platform}`);
  if (recording.participantNames?.length) {
    lines.push(`**Participants:** ${recording.participantNames.join(", ")}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Summary
  if (recording.summary) {
    lines.push(recording.summary);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Transcript
  if (recording.transcription) {
    lines.push("## Full Transcript");
    lines.push("");
    for (const seg of recording.transcription.segments) {
      const time = formatTime(seg.start);
      const speaker = seg.speaker ? `**${seg.speaker}:** ` : "";
      lines.push(`\`${time}\` ${speaker}${seg.text}`);
    }
    lines.push("");
  }

  // Notes
  if (recording.notes.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Meeting Notes");
    lines.push("");
    for (const note of recording.notes) {
      lines.push(`- \`${formatTime(note.timestamp / 1000)}\` ${note.text}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Exported by Notetaker — ${new Date().toLocaleDateString()}*`);

  return lines.join("\n");
}

// ── Export: Action Items Only ──

export function extractActionItems(summary: string): string {
  if (!summary) return "";

  const lines = summary.split("\n");
  const actionLines: string[] = [];
  let inActionSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect "Action Items" section heading
    if (/^#{1,3}\s*action\s*items/i.test(trimmed)) {
      inActionSection = true;
      actionLines.push(trimmed);
      continue;
    }

    // Detect any other heading → leave the action section
    if (/^#{1,3}\s/.test(trimmed) && inActionSection) {
      inActionSection = false;
      continue;
    }

    if (inActionSection && trimmed.length > 0) {
      actionLines.push(trimmed);
    }
  }

  if (actionLines.length <= 1) {
    // Fallback: look for lines containing action-like keywords
    return lines
      .filter((l) => /action|todo|follow[- ]?up|assign|task|deadline/i.test(l))
      .join("\n") || "No action items found in this summary.";
  }

  return actionLines.join("\n");
}

// ── Export: JSON (machine-readable) ──

export function exportAsJSON(recording: RecordingMeta): string {
  const exportData = {
    id: recording.id,
    title: recording.title,
    date: new Date(recording.startedAt).toISOString(),
    duration: recording.duration,
    platform: recording.platform || null,
    participants: recording.participantNames || [],
    summary: recording.summary || null,
    transcript: recording.transcription
      ? recording.transcription.segments.map((seg) => ({
          start: seg.start,
          end: seg.end,
          speaker: seg.speaker || null,
          text: seg.text,
        }))
      : null,
    notes: recording.notes.map((n) => ({
      timestamp: n.timestamp,
      text: n.text,
    })),
    exportedAt: new Date().toISOString(),
  };

  return JSON.stringify(exportData, null, 2);
}

// ── Export: Rich HTML (for pasting into Slack/Email with formatting) ──

export function exportAsRichHTML(recording: RecordingMeta): string {
  const parts: string[] = [];

  parts.push(`<h2 style="margin:0 0 4px 0;font-family:system-ui,sans-serif;">${escapeHtml(recording.title)}</h2>`);
  parts.push(`<p style="margin:0 0 8px 0;color:#888;font-size:13px;font-family:system-ui,sans-serif;">`);
  parts.push(`${formatDate(recording.startedAt)} · ${formatDuration(recording.duration)}`);
  if (recording.platform) parts.push(` · ${escapeHtml(recording.platform)}`);
  parts.push(`</p>`);

  if (recording.summary) {
    parts.push(`<hr style="border:none;border-top:1px solid #ddd;margin:12px 0;" />`);
    // Convert markdown-ish summary to basic HTML
    const htmlSummary = recording.summary
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^## (.+)$/gm, '<h3 style="margin:12px 0 4px 0;font-family:system-ui,sans-serif;">$1</h3>')
      .replace(/^### (.+)$/gm, '<h4 style="margin:8px 0 4px 0;font-family:system-ui,sans-serif;">$1</h4>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul style="margin:4px 0;padding-left:20px;">${match}</ul>`)
      .replace(/\n{2,}/g, "<br/>")
      .replace(/\n/g, "<br/>");
    parts.push(htmlSummary);
  }

  if (recording.notes.length > 0) {
    parts.push(`<hr style="border:none;border-top:1px solid #ddd;margin:12px 0;" />`);
    parts.push(`<h3 style="margin:8px 0 4px 0;font-family:system-ui,sans-serif;">Notes</h3>`);
    parts.push(`<ul style="margin:4px 0;padding-left:20px;">`);
    for (const note of recording.notes) {
      parts.push(`<li><code>${formatTime(note.timestamp / 1000)}</code> ${escapeHtml(note.text)}</li>`);
    }
    parts.push(`</ul>`);
  }

  return parts.join("\n");
}

// ── Export: Email Draft ──

export function getEmailDraftUrl(recording: RecordingMeta): string {
  const subject = encodeURIComponent(`Meeting Notes: ${recording.title}`);
  const body = encodeURIComponent(exportAsMarkdown(recording));
  return `mailto:?subject=${subject}&body=${body}`;
}

// ── Download Utility (triggers browser save-as dialog) ──

export function downloadTextFile(content: string, filename: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Clipboard Helpers ──

export async function copyRichHtml(html: string, fallbackText: string): Promise<void> {
  try {
    // Try the modern Clipboard API with HTML support
    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([fallbackText], { type: "text/plain" });
    const item = new ClipboardItem({
      "text/html": htmlBlob,
      "text/plain": textBlob,
    });
    await navigator.clipboard.write([item]);
  } catch {
    // Fallback: plain text copy
    await navigator.clipboard.writeText(fallbackText);
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
