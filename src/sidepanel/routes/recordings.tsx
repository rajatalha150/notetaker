import { Link } from "@tanstack/react-router";
import { useRecordings } from "@shared/hooks/useRecordings";
import { RecordingCard } from "../components/RecordingCard";

export function RecordingsPage() {
  const { recordings, isLoading, deleteRecording } = useRecordings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </div>
        <p className="text-sm text-gray-400 font-medium">No recordings yet</p>
        <p className="text-xs text-gray-600 mt-1">Click the extension icon to start recording</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recordings.map((r) => (
        <Link key={r.id} to="/recording/$id" params={{ id: r.id }} className="block">
          <RecordingCard recording={r} onDelete={() => deleteRecording(r.id)} />
        </Link>
      ))}
    </div>
  );
}
