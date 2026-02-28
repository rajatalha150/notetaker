// Offscreen document: has DOM/media APIs that the service worker lacks.
// Collects audio chunks in memory, on stop sends a data URL back to background for download.

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

      const tabSource = audioContext.createMediaStreamSource(tabStream);
      tabSource.connect(destination);
      // Let user still hear the call
      tabSource.connect(audioContext.destination);

      if (captureMic) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const micSource = audioContext.createMediaStreamSource(micStream);
          micSource.connect(destination);
        } catch {
          // Mic unavailable
        }
      }

      mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      recorder = new MediaRecorder(destination.stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.start(5000);
      return { ok: true };
    }

    case "OFFSCREEN_STOP": {
      if (!recorder || recorder.state === "inactive") {
        return { error: "Not recording" };
      }

      // Wait for recorder to finish and return the data URL
      const dataUrl = await new Promise<string>((resolve) => {
        recorder!.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
          cleanupStreams();
        };
        recorder!.stop();
      });

      return { dataUrl };
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
