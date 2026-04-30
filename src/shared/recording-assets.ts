import { getRecording } from "./storage/metadata";
import { getRecordingAudioAsset } from "./storage/audio-assets";

function getElectronDesktopApi() {
  const scope = globalThis as typeof globalThis & {
    electron?: {
      desktop?: {
        readRecording(filePath: string): Promise<ArrayBuffer>;
      };
    };
  };

  return scope.electron?.desktop;
}

export async function getRecordingAudioFile(recordingId: string): Promise<File> {
  const meta = await getRecording(recordingId);
  if (!meta) {
    throw new Error("Recording not found");
  }

  if (meta.filePath && meta.environment === "desktop") {
    const desktop = getElectronDesktopApi();
    if (!desktop?.readRecording) {
      throw new Error("Desktop recording files are only available inside the desktop app");
    }

    const buffer = await desktop.readRecording(meta.filePath);
    const mimeType = meta.mimeType || "audio/webm";

    return new File(
      [buffer],
      meta.filename || `${recordingId}.webm`,
      { type: mimeType }
    );
  }

  const storedAudio = await getRecordingAudioAsset(recordingId);
  if (storedAudio) {
    const mimeType = meta.mimeType || storedAudio.type || "audio/webm";
    return new File(
      [storedAudio],
      meta.filename || `${recordingId}.webm`,
      { type: mimeType }
    );
  }

  throw new Error("Recording audio is not cached locally. Select the file manually.");
}
