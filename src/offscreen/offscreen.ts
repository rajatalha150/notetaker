// Offscreen document: has DOM/media APIs that the service worker lacks.
// Collects audio chunks in memory, on stop saves to IndexedDB and triggers download directly.

import { saveRecordingAudioAsset } from "@shared/storage/audio-assets";

let recorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let tabStream: MediaStream | null = null;
let micStream: MediaStream | null = null;
let chunks: Blob[] = [];
let mimeType = "audio/webm";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== "offscreen") return false;
  handleOffscreenMessage(msg).then(sendResponse);
  return true;
});

async function handleOffscreenMessage(msg: {
  target: string;
  type: string;
  streamId?: string;
  captureMic?: boolean;
  recordingId?: string;
}) {
  switch (msg.type) {
    case "OFFSCREEN_START": {
      const { streamId, captureMic } = msg;
      if (!streamId) return { error: "Missing streamId" };
      chunks = [];

      tabStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId,
          },
        } as MediaTrackConstraints,
      });

      audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      destination.channelCount = 2;

      const tabSource = audioContext.createMediaStreamSource(tabStream);

      let micCaptured = false;

      if (captureMic) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          });
          const micSource = audioContext.createMediaStreamSource(micStream);

          // Pan Mic hard left (-1) -> "You"
          const micPanner = audioContext.createStereoPanner();
          micPanner.pan.value = -1;
          micSource.connect(micPanner);
          micPanner.connect(destination);

          // Pan Tab hard right (1) -> "Speaker 2"
          const tabPanner = audioContext.createStereoPanner();
          tabPanner.pan.value = 1;
          tabSource.connect(tabPanner);
          tabPanner.connect(destination);

          micCaptured = true;
          // Let user still hear the call
          tabSource.connect(audioContext.destination);
        } catch (err) {
          console.warn("Microphone capture failed:", err);
          tabSource.connect(destination);
          tabSource.connect(audioContext.destination);
        }
      } else {
        tabSource.connect(destination);
        tabSource.connect(audioContext.destination);
      }

      mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      recorder = new MediaRecorder(destination.stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.start(5000);
      return { ok: true, micCaptured };
    }

    case "OFFSCREEN_STOP": {
      if (!recorder || recorder.state === "inactive") {
        return { error: "Not recording", mimeType };
      }

      // Wait for recorder to finish, persist the blob for later transcription,
      // then trigger download directly from the offscreen document.
      // Avoids sending large data URLs through chrome.runtime.sendMessage (64KB limit).
      const result = await new Promise<{ mimeType: string; downloadId?: number }>((resolve, reject) => {
        recorder!.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);

          void (async () => {
            try {
              // 1. Cache audio in IndexedDB for later transcription
              if (msg.recordingId) {
                try {
                  await saveRecordingAudioAsset(msg.recordingId, blob);
                } catch (error) {
                  console.warn("Failed to cache recording audio locally:", error);
                }
              }

              // 2. Trigger download directly from offscreen document.
              //    Object URLs are scoped to this document context, so we must call
              //    chrome.downloads.download from here, not from the service worker.
              const downloadId = await chrome.downloads.download({
                url: blobUrl,
                filename: `notetaker-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`,
                saveAs: false,
              });

              // 3. Revoke the object URL after download has had time to start
              setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);

              cleanupStreams();
              resolve({ mimeType: blob.type || mimeType, downloadId });
            } catch (err) {
              cleanupStreams();
              URL.revokeObjectURL(blobUrl);
              reject(err);
            }
          })();
        };
        recorder!.stop();
      });

      return result;
    }

    case "OFFSCREEN_PAUSE": {
      if (recorder && recorder.state === "recording") recorder.pause();
      return { ok: true };
    }

    case "OFFSCREEN_RESUME": {
      if (recorder && recorder.state === "paused") recorder.resume();
      return { ok: true };
    }

    default:
      return { error: "Unknown offscreen message" };
  }
}

function cleanupStreams() {
  tabStream?.getTracks().forEach((t) => t.stop());
  micStream?.getTracks().forEach((t) => t.stop());
  audioContext?.close();
  tabStream = null;
  micStream = null;
  audioContext = null;
  recorder = null;
  chunks = [];
}
