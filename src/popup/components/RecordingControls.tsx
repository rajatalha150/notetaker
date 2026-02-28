import { useState, useEffect, useCallback } from "react";
import type { RecordingStatus } from "@shared/types";

interface Props {
  status: RecordingStatus;
  startRecording: (tabId: number, captureMic: boolean) => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
}

async function checkMicPermission(): Promise<boolean> {
  try {
    const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return result.state === "granted";
  } catch {
    return false;
  }
}

export function RecordingControls({
  status,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
}: Props) {
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [pendingStart, setPendingStart] = useState(false);

  useEffect(() => {
    checkMicPermission().then(setMicGranted);
  }, []);

  const doStartRecording = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await startRecording(tab.id, true);
    }
  }, [startRecording]);

  // Listen for permission granted message to auto-start recording
  useEffect(() => {
    const listener = (msg: { type: string }) => {
      if (msg.type === "MIC_PERMISSION_GRANTED") {
        setMicGranted(true);
        setPendingStart(false);
        doStartRecording();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [doStartRecording]);

  const handleStart = async () => {
    const hasPermission = await checkMicPermission();
    if (hasPermission) {
      setMicGranted(true);
      await doStartRecording();
      return;
    }

    // Open small popup window for permission
    setPendingStart(true);
    chrome.windows.create({
      url: chrome.runtime.getURL("src/permissions/index.html"),
      type: "popup",
      width: 400,
      height: 300,
      focused: true,
    });
  };

  if (status === "idle" || status === "stopped") {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleStart}
          disabled={pendingStart}
          className={`w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 transition-all duration-150 flex items-center justify-center shadow-lg shadow-red-900/30 hover:shadow-red-900/50 ${pendingStart ? "animate-recording-pulse" : ""}`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </button>
        {pendingStart && (
          <p className="text-xs text-yellow-400 animate-fade-in">Waiting for mic permission...</p>
        )}
        {micGranted === false && !pendingStart && (
          <p className="text-xs text-gray-500">Mic permission required</p>
        )}
        {micGranted === true && (
          <p className="text-xs text-gray-500">Click to start recording</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2 animate-fade-in">
      {status === "recording" ? (
        <button
          onClick={() => pauseRecording()}
          className="flex-1 py-2.5 px-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          Pause
        </button>
      ) : (
        <button
          onClick={() => resumeRecording()}
          className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-500 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          Resume
        </button>
      )}
      <button
        onClick={() => stopRecording()}
        className="flex-1 py-2.5 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-800/50 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        Stop
      </button>
    </div>
  );
}
