import { RecordingControls } from "./components/RecordingControls";
import { StatusIndicator } from "./components/StatusIndicator";
import { QuickNotes } from "./components/QuickNotes";
import { useRecordingState } from "@shared/hooks/useRecordingState";

export default function App() {
  const recording = useRecordingState();

  return (
    <div className="w-80 bg-gray-950 text-gray-100 min-h-[200px] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-800/60">
        <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
        </div>
        <span className="text-sm font-semibold tracking-tight">Notetaker</span>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 flex flex-col">
        <StatusIndicator status={recording.status} duration={recording.duration} />

        <RecordingControls {...recording} />

        {recording.status !== "idle" && (
          <QuickNotes recordingId={recording.recordingId} />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-800/60">
        <button
          className="w-full text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center justify-center gap-1.5"
          onClick={() => chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>
          </svg>
          Open Side Panel
        </button>
      </div>
    </div>
  );
}
