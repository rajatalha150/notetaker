import type { BackgroundMessage, StatusResponse } from "@shared/messages";
import { broadcast } from "@shared/messages";
import type { Note } from "@shared/types";
import {
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
  getRecorderState,
  getElapsedMs,
} from "./recorder";
import { saveRecording, getRecording } from "@shared/storage/metadata";

export async function handleMessage(
  msg: BackgroundMessage,
  _sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (msg.type) {
    case "START_RECORDING": {
      const recordingId = await startRecording(msg.tabId, msg.captureMic);
      const now = Date.now();
      await saveRecording({
        id: recordingId,
        title: `Recording ${new Date(now).toLocaleString()}`,
        startedAt: now,
        duration: 0,
        status: "recording",
        notes: [],
      });
      broadcast({ type: "RECORDING_STARTED", recordingId });
      return { recordingId };
    }

    case "STOP_RECORDING": {
      const recState = getRecorderState();
      if (!recState) return { error: "Not recording" };
      const duration = getElapsedMs();
      const result = await stopRecording();
      if (result) {
        const meta = await getRecording(result.recordingId);
        if (meta) {
          meta.status = "stopped";
          meta.stoppedAt = Date.now();
          meta.duration = duration;
          meta.downloadId = result.downloadId;
          meta.filename = result.filename;
          await saveRecording(meta);
        }
        broadcast({ type: "RECORDING_STOPPED", recordingId: result.recordingId });
      }
      return { recordingId: result?.recordingId };
    }

    case "PAUSE_RECORDING": {
      await pauseRecording();
      broadcast({ type: "RECORDING_PAUSED" });
      return { ok: true };
    }

    case "RESUME_RECORDING": {
      await resumeRecording();
      broadcast({ type: "RECORDING_RESUMED" });
      return { ok: true };
    }

    case "GET_STATUS": {
      const s = getRecorderState();
      const response: StatusResponse = {
        status: s?.status ?? "idle",
        recordingId: s?.recordingId,
        startedAt: s?.startedAt,
        duration: getElapsedMs(),
      };
      return response;
    }

    case "ADD_NOTE": {
      const s = getRecorderState();
      if (!s) return { error: "Not recording" };
      const meta = await getRecording(s.recordingId);
      if (!meta) return { error: "Recording not found" };
      const note: Note = {
        id: crypto.randomUUID(),
        text: msg.text,
        timestamp: getElapsedMs(),
        createdAt: Date.now(),
      };
      meta.notes.push(note);
      await saveRecording(meta);
      return { note };
    }

    default:
      return { error: "Unknown message type" };
  }
}
