import type { RecordingStatus } from "./types";

// Background actions
type StartRecording = { type: "START_RECORDING"; tabId: number; captureMic: boolean };
type StopRecording = { type: "STOP_RECORDING" };
type PauseRecording = { type: "PAUSE_RECORDING" };
type ResumeRecording = { type: "RESUME_RECORDING" };
type GetStatus = { type: "GET_STATUS" };
type AddNote = { type: "ADD_NOTE"; text: string };
type PlatformDetected = { type: "PLATFORM_DETECTED"; platform: string };
type UserNameDetected = { type: "USER_NAME_DETECTED"; name: string };
type SpeakerActive = { type: "SPEAKER_ACTIVE"; name: string };

export type BackgroundMessage =
  | StartRecording
  | StopRecording
  | PauseRecording
  | ResumeRecording
  | GetStatus
  | AddNote
  | PlatformDetected
  | UserNameDetected
  | SpeakerActive;

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

export type BroadcastEvent =
  | RecordingStarted
  | RecordingStopped
  | RecordingPaused
  | RecordingResumed;

export function sendToBackground<T = unknown>(msg: BackgroundMessage): Promise<T> {
  return chrome.runtime.sendMessage(msg);
}

export function broadcast(event: BroadcastEvent) {
  chrome.runtime.sendMessage(event).catch(() => {
    // No listeners - that's fine
  });
}
