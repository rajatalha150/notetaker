import { RecordingControls } from "./components/RecordingControls";
import { StatusIndicator } from "./components/StatusIndicator";
import { QuickNotes } from "./components/QuickNotes";
import { useRecordingState } from "@shared/hooks/useRecordingState";

export default function App() {
  const recording = useRecordingState();

  return (
    <div className="w-80 p-4 bg-gray-950 text-gray-100 min-h-[200px]">
      <h1 className="text-lg font-semibold mb-3">Notetaker</h1>
      <StatusIndicator status={recording.status} duration={recording.duration} />
      <RecordingControls {...recording} />
      {recording.status !== "idle" && (
        <QuickNotes recordingId={recording.recordingId} />
      )}
      <button
        className="mt-3 w-full text-xs text-gray-400 hover:text-gray-200 transition-colors"
        onClick={() => chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })}
      >
        Open Side Panel
      </button>
    </div>
  );
}
