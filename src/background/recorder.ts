// Background recorder: manages state and delegates media work to offscreen document.
// On stop, receives a data URL from offscreen and triggers chrome.downloads.

export interface RecorderState {
  recordingId: string;
  status: "recording" | "paused";
  startedAt: number;
  pausedDuration: number;
  lastPausedAt?: number;
}

let state: RecorderState | null = null;

export function getRecorderState(): RecorderState | null {
  return state;
}

export function getElapsedMs(): number {
  if (!state) return 0;
  const now = Date.now();
  const total = now - state.startedAt;
  const paused =
    state.pausedDuration + (state.lastPausedAt ? now - state.lastPausedAt : 0);
  return total - paused;
}

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: "src/offscreen/offscreen.html",
    reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: "Recording tab audio and microphone",
  });
}

function sendToOffscreen(msg: Record<string, unknown>) {
  return chrome.runtime.sendMessage({ ...msg, target: "offscreen" });
}

export async function startRecording(
  tabId: number,
  captureMic: boolean
): Promise<{ recordingId: string; captureMic: boolean }> {
  if (state) throw new Error("Already recording");

  const recordingId = crypto.randomUUID();

  const streamId = await new Promise<string>((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(id);
      }
    });
  });

  await ensureOffscreenDocument();

  await sendToOffscreen({
    type: "OFFSCREEN_START",
    streamId,
    captureMic,
    recordingId,
  });

  state = {
    recordingId,
    status: "recording",
    startedAt: Date.now(),
    pausedDuration: 0,
  };

  return { recordingId, captureMic };
}

export async function pauseRecording() {
  if (!state || state.status !== "recording") return;
  await sendToOffscreen({ type: "OFFSCREEN_PAUSE" });
  state.status = "paused";
  state.lastPausedAt = Date.now();
}

export async function resumeRecording() {
  if (!state || state.status !== "paused") return;
  await sendToOffscreen({ type: "OFFSCREEN_RESUME" });
  state.status = "recording";
  if (state.lastPausedAt) {
    state.pausedDuration += Date.now() - state.lastPausedAt;
    state.lastPausedAt = undefined;
  }
}

export interface StartResult {
  recordingId: string;
  captureMic: boolean;
}

export interface StopResult {
  recordingId: string;
  downloadId: number;
  filename: string;
  mimeType: string;
}

export async function stopRecording(): Promise<StopResult | null> {
  if (!state) return null;
  const recordingId = state.recordingId;
  // Offscreen document now handles the download directly (avoids 64KB message limit).
  // It returns the downloadId it got from chrome.downloads.download.
  const result = (await sendToOffscreen({ type: "OFFSCREEN_STOP", recordingId })) as {
    mimeType?: string;
    downloadId?: number;
    error?: string;
  };
  state = null;

  if (result?.error) return null;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `notetaker-${timestamp}.webm`;

  return {
    recordingId,
    downloadId: result?.downloadId ?? 0,
    filename,
    mimeType: result?.mimeType || "audio/webm",
  };
}
