import type { RecordingStatus } from "@shared/types";

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function StatusIndicator({
  status,
  duration,
}: {
  status: RecordingStatus;
  duration: number;
}) {
  const colors: Record<RecordingStatus, string> = {
    idle: "bg-gray-500",
    recording: "bg-red-500 animate-pulse",
    paused: "bg-yellow-500",
    stopped: "bg-gray-500",
  };

  const labels: Record<RecordingStatus, string> = {
    idle: "Ready",
    recording: "Recording",
    paused: "Paused",
    stopped: "Stopped",
  };

  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-2.5 h-2.5 rounded-full ${colors[status]}`} />
      <span className="text-sm font-medium">{labels[status]}</span>
      {status !== "idle" && (
        <span className="ml-auto text-sm font-mono text-gray-400">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );
}
