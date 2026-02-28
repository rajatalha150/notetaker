import { Link } from "@tanstack/react-router";
import { useRecordings } from "@shared/hooks/useRecordings";
import { RecordingCard } from "../components/RecordingCard";

export function RecordingsPage() {
  const { recordings, isLoading, deleteRecording } = useRecordings();

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>;

  if (recordings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No recordings yet</p>
        <p className="text-xs mt-1">Use the popup to start recording</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recordings.map((r) => (
        <Link key={r.id} to="/recording/$id" params={{ id: r.id }} className="block">
          <RecordingCard recording={r} onDelete={() => deleteRecording(r.id)} />
        </Link>
      ))}
    </div>
  );
}
