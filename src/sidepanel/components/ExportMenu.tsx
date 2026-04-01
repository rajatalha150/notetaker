import { useState, useRef, useEffect } from "react";
import type { RecordingMeta } from "@shared/types";
import {
  exportAsMarkdown,
  exportAsJSON,
  exportAsRichHTML,
  extractActionItems,
  downloadTextFile,
  copyRichHtml,
  getEmailDraftUrl,
} from "@shared/api/export";

interface ExportMenuProps {
  recording: RecordingMeta;
}

interface ExportOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: (recording: RecordingMeta) => void | Promise<void>;
  requiresTranscription?: boolean;
  requiresSummary?: boolean;
}

export function ExportMenu({ recording }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const safeFilename = (recording.title || "meeting")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();

  const options: ExportOption[] = [
    {
      id: "clipboard-rich",
      label: "Copy to Clipboard",
      description: "Rich HTML — paste into Slack, Email, or Docs",
      icon: "📋",
      requiresSummary: true,
      action: async (rec) => {
        const html = exportAsRichHTML(rec);
        const text = exportAsMarkdown(rec);
        await copyRichHtml(html, text);
        showFeedback("Copied with formatting!");
      },
    },
    {
      id: "action-items",
      label: "Copy Action Items",
      description: "Extract and copy just the action items",
      icon: "✅",
      requiresSummary: true,
      action: async (rec) => {
        const items = extractActionItems(rec.summary || "");
        await navigator.clipboard.writeText(items);
        showFeedback("Action items copied!");
      },
    },
    {
      id: "markdown",
      label: "Download Markdown",
      description: "Full report as .md file",
      icon: "📝",
      requiresTranscription: true,
      action: (rec) => {
        const md = exportAsMarkdown(rec);
        downloadTextFile(md, `${safeFilename}.md`, "text/markdown");
        showFeedback("Markdown downloaded!");
      },
    },
    {
      id: "json",
      label: "Download JSON",
      description: "Structured data for APIs and integrations",
      icon: "📦",
      requiresTranscription: true,
      action: (rec) => {
        const json = exportAsJSON(rec);
        downloadTextFile(json, `${safeFilename}.json`, "application/json");
        showFeedback("JSON downloaded!");
      },
    },
    {
      id: "transcript-txt",
      label: "Download Transcript",
      description: "Plain text transcript with timestamps",
      icon: "📄",
      requiresTranscription: true,
      action: (rec) => {
        if (!rec.transcription) return;
        const lines = rec.transcription.segments.map((seg) => {
          const time = `${String(Math.floor(seg.start / 60)).padStart(2, "0")}:${String(Math.floor(seg.start % 60)).padStart(2, "0")}`;
          const speaker = seg.speaker ? `${seg.speaker}: ` : "";
          return `[${time}] ${speaker}${seg.text}`;
        });
        downloadTextFile(lines.join("\n"), `${safeFilename}-transcript.txt`);
        showFeedback("Transcript downloaded!");
      },
    },
    {
      id: "email",
      label: "Email Draft",
      description: "Open email client with pre-filled meeting notes",
      icon: "✉️",
      requiresSummary: true,
      action: (rec) => {
        const url = getEmailDraftUrl(rec);
        window.open(url, "_blank");
        showFeedback("Email draft opened!");
      },
    },
  ];

  const hasContent = !!(recording.transcription || recording.summary);

  if (!hasContent) return null;

  return (
    <div ref={menuRef} className="relative inline-block">
      {/* Export Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          feedback
            ? "bg-emerald-900/20 text-emerald-400 border border-emerald-800/30"
            : "bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700/50"
        }`}
      >
        {feedback ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {feedback}
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Export
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-gray-900 border border-gray-800/80 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 border-b border-gray-800/60">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Export Meeting</p>
          </div>
          <div className="py-1">
            {options.map((opt) => {
              const disabled =
                (opt.requiresTranscription && !recording.transcription) ||
                (opt.requiresSummary && !recording.summary);

              return (
                <button
                  key={opt.id}
                  disabled={disabled}
                  onClick={async () => {
                    setIsOpen(false);
                    await opt.action(recording);
                  }}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-all ${
                    disabled
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:bg-gray-800/60 cursor-pointer"
                  }`}
                >
                  <span className="text-base mt-0.5 shrink-0">{opt.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{opt.label}</p>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-gray-800/60 bg-gray-950/50">
            <p className="text-[10px] text-gray-600">
              🔒 All exports generated locally — no data sent anywhere.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
