import { useState } from "react";
import { useNotes } from "@shared/hooks/useNotes";

export function QuickNotes({ recordingId }: { recordingId: string | undefined }) {
  const { notes, addNote, isAdding } = useNotes(recordingId);
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    addNote(trimmed);
    setText("");
  };

  return (
    <div className="mt-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Quick note..."
          className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-gray-500"
        />
        <button
          type="submit"
          disabled={isAdding || !text.trim()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium transition-colors"
        >
          Add
        </button>
      </form>
      {notes.length > 0 && (
        <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
          {notes.slice(-5).map((n) => (
            <li key={n.id} className="text-xs text-gray-400 truncate">
              <span className="text-gray-500 font-mono">
                {formatTimestamp(n.timestamp)}
              </span>{" "}
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatTimestamp(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
