import type { RecordingStatus } from "@shared/types";

interface Props {
  status: RecordingStatus;
  startRecording: (tabId: number, captureMic: boolean) => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
}

export function RecordingControls({
  status,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
}: Props) {
  const handleStart = async () => {
    // Request mic permission from popup (which can show the browser prompt).
    // Offscreen documents cannot prompt for permissions on their own.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop — we just needed the permission grant.
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      // User denied mic — proceed without mic (tab audio only)
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await startRecording(tab.id, true);
    }
  };

  if (status === "idle" || status === "stopped") {
    return (
      <button
        onClick={handleStart}
        className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
      >
        Start Recording
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      {status === "recording" ? (
        <button
          onClick={() => pauseRecording()}
          className="flex-1 py-2 px-4 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium transition-colors"
        >
          Pause
        </button>
      ) : (
        <button
          onClick={() => resumeRecording()}
          className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
        >
          Resume
        </button>
      )}
      <button
        onClick={() => stopRecording()}
        className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors"
      >
        Stop
      </button>
    </div>
  );
}
