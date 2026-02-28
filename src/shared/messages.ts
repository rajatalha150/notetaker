import type { RecordingStatus } from "./types";

// Background actions
type StartRecording = { type: "START_RECORDING"; tabId: number; captureMic: boolean };
type StopRecording = { type: "STOP_RECORDING" };
type PauseRecording = { type: "PAUSE_RECORDING" };
type ResumeRecording = { type: "RESUME_RECORDING" };
type GetStatus = { type: "GET_STATUS" };
type AddNote = { type: "ADD_NOTE"; text: string };

export type BackgroundMessage =
  | StartRecording
  | StopRecording
  | PauseRecording
  | ResumeRecording
  | GetStatus
  | AddNote;

// Responses
export type StatusResponse = {
  status: RecordingStatus;
  recordingId?: string;
  startedAt?: number;
  duration: number;
};

// Events broadcast from background
type RecordingStarted = { type: "RECORDING_STARTED"; recordingId: string };
type RecordingStopped = { type: "RECORDING_STOPPED"; recordingId: string };
type RecordingPaused = { type: "RECORDING_PAUSED" };
type RecordingResumed = { type: "RECORDING_RESUMED" };
type PlatformDetected = { type: "PLATFORM_DETECTED"; platform: string; tabId: number };

export type BroadcastEvent =
  | RecordingStarted
  | RecordingStopped
  | RecordingPaused
  | RecordingResumed
  | PlatformDetected;

export function sendToBackground<T = unknown>(msg: BackgroundMessage): Promise<T> {
  return chrome.runtime.sendMessage(msg);
}

export function broadcast(event: BroadcastEvent) {
  chrome.runtime.sendMessage(event).catch(() => {
    // No listeners - that's fine
  });
}
