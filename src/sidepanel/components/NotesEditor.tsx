import type { Note } from "@shared/types";

function formatTimestamp(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function NotesEditor({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null;

  const copyAll = () => {
    const text = notes.map((n) => `[${formatTimestamp(n.timestamp)}] ${n.text}`).join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Notes ({notes.length})</h3>
        <button onClick={copyAll} className="text-xs text-gray-400 hover:text-gray-200">
          Copy All
        </button>
      </div>
      <ul className="space-y-1.5">
        {notes.map((n) => (
          <li key={n.id} className="text-sm">
            <span className="text-xs text-gray-500 font-mono mr-2">
              {formatTimestamp(n.timestamp)}
            </span>
            {n.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
