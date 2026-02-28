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
    <div className="p-3 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium">{recording.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(recording.startedAt).toLocaleString()} &middot; {min}m {sec}s
          </p>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
          className="text-gray-600 hover:text-red-400 text-xs transition-colors"
        >
          Delete
        </button>
      </div>
      <div className="flex gap-2 mt-1.5">
        {recording.notes.length > 0 && (
          <span className="text-xs px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
            {recording.notes.length} notes
          </span>
        )}
        {recording.transcription && (
          <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 rounded text-blue-400">
            Transcribed
          </span>
        )}
        {recording.summary && (
          <span className="text-xs px-1.5 py-0.5 bg-purple-900/50 rounded text-purple-400">
            Summarized
          </span>
        )}
      </div>
    </div>
  );
}
