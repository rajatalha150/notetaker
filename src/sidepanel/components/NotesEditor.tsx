import { useState } from "react";
import type { Note } from "@shared/types";

function formatTimestamp(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function NotesEditor({ notes }: { notes: Note[] }) {
  const [copied, setCopied] = useState(false);

  if (notes.length === 0) return null;

  const copyAll = () => {
    const text = notes.map((n) => `[${formatTimestamp(n.timestamp)}] ${n.text}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Notes <span className="text-gray-600">({notes.length})</span>
        </h3>
        <button onClick={copyAll} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          {copied ? "Copied!" : "Copy All"}
        </button>
      </div>
      <ul className="space-y-1.5 bg-gray-900/50 border border-gray-800/50 rounded-lg p-4">
        {notes.map((n) => (
          <li key={n.id} className="text-sm leading-relaxed">
            <span className="text-[10px] text-gray-600 font-mono mr-2 tabular-nums">
              {formatTimestamp(n.timestamp)}
            </span>
            <span className="text-gray-300">{n.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
