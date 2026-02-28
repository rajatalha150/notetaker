import { useState } from "react";
import type { Transcription } from "@shared/types";

export function TranscriptionView({ transcription }: { transcription?: Transcription }) {
  const [copied, setCopied] = useState(false);

  if (!transcription) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(transcription.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Transcript</h3>
        <button onClick={handleCopy} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
        {transcription.segments.map((seg, i) => (
          <p key={i} className="text-sm leading-relaxed">
            <span className="text-[10px] text-gray-600 font-mono mr-2 tabular-nums">
              {formatTime(seg.start)}
            </span>
            <span className="text-gray-300">{seg.text}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
