import type { RecordingMeta } from "@shared/types";

export function RecordingCard({
  recording,
  onDelete,
}: {
  recording: RecordingMeta;
  onDelete: () => void;
}) {
  const durationSec = Math.floor(recording.duration / 1000);
  const min = Math.floor(durationSec / 60);
  const sec = durationSec % 60;

  return (
    <div className="p-3.5 bg-gray-900/50 rounded-lg border border-gray-800/50 hover:border-gray-700/80 hover:bg-gray-900/80 transition-all group">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium truncate">{recording.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(recording.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            {" "}&middot; {min}m {sec}s
          </p>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
          className="text-gray-700 hover:text-red-400 text-xs transition-colors opacity-0 group-hover:opacity-100 ml-2 shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
      {(recording.notes.length > 0 || recording.transcription || recording.summary) && (
        <div className="flex gap-1.5 mt-2">
          {recording.notes.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-800/80 rounded-full text-gray-500 font-medium">
              {recording.notes.length} notes
            </span>
          )}
          {recording.transcription && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/30 rounded-full text-blue-400/80 font-medium">
              Transcribed
            </span>
          )}
          {recording.summary && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-900/30 rounded-full text-purple-400/80 font-medium">
              Summarized
            </span>
          )}
        </div>
      )}
    </div>
  );
}
