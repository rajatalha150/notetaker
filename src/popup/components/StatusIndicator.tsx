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
  const dotClass: Record<RecordingStatus, string> = {
    idle: "bg-gray-500",
    recording: "bg-red-500 animate-dot-pulse",
    paused: "bg-yellow-500",
    stopped: "bg-gray-500",
  };

  const labels: Record<RecordingStatus, string> = {
    idle: "Ready to record",
    recording: "Recording",
    paused: "Paused",
    stopped: "Stopped",
  };

  const labelColors: Record<RecordingStatus, string> = {
    idle: "text-gray-400",
    recording: "text-red-400",
    paused: "text-yellow-400",
    stopped: "text-gray-400",
  };

  return (
    <div className="flex items-center gap-2 mb-4 px-1">
      <span className={`w-2 h-2 rounded-full ${dotClass[status]}`} />
      <span className={`text-xs font-medium ${labelColors[status]}`}>{labels[status]}</span>
      {status !== "idle" && (
        <span className="ml-auto text-sm font-mono text-gray-300 tabular-nums">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );
}
