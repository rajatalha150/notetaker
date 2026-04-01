import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transcribe, diarizeSpeakers, mergeSpeakerEvents } from "../api/providers";
import { getRecording, saveRecording } from "../storage/metadata";
import { getRecordingAudioFile } from "../recording-assets";
import type { Transcription, TranscriptionSegment } from "../types";

export function useTranscription(recordingId: string | undefined) {
  const qc = useQueryClient();

  const { data: transcription } = useQuery({
    queryKey: ["transcription", recordingId],
    queryFn: async () => {
      if (!recordingId) return null;
      const meta = await getRecording(recordingId);
      return meta?.transcription ?? null;
    },
    enabled: !!recordingId,
  });

  const transcribeMutation = useMutation({
    mutationFn: async (audio: Blob) => {
      // 1. Run transcription (Whisper + channel-based speaker assignment)
      const result = await transcribe(audio);

      if (!recordingId) return result;

      const meta = await getRecording(recordingId);
      if (!meta) return result;

      let segments: TranscriptionSegment[] = result.segments;

      // 2. Apply speakerEvents from recording metadata.
      //    These come from the real-time speaker monitor during recording
      //    (mic vs system audio level analysis, desktop native window detection).
      //    They override generic "Speaker 2" labels with actual detected names.
      if (meta.speakerEvents?.length) {
        segments = mergeSpeakerEvents(segments, meta.speakerEvents);
      }

      // 3. Replace generic labels with detected participant names
      const participantNames = Array.from(new Set([
        ...(meta.detectedParticipantNames ?? []),
        ...(meta.participantNames ?? []),
      ]));

      // If we have exactly one external participant name, replace all "Speaker 2" labels
      if (participantNames.length === 1 && participantNames[0]) {
        const realName = participantNames[0];
        segments = segments.map(seg => ({
          ...seg,
          speaker: seg.speaker === "Speaker 2" ? realName : seg.speaker,
        }));
      }

      // If the recording has a userName, replace "You" with the actual name
      if (meta.userName && meta.userName !== "You") {
        segments = segments.map(seg => ({
          ...seg,
          speaker: seg.speaker === "You" ? meta.userName! : seg.speaker,
        }));
      }

      // 4. If segments still have no speaker labels (no stereo data was available),
      //    fall back to AI-based diarization from text context.
      const hasAnySpeaker = segments.some(s => s.speaker);
      if (!hasAnySpeaker && segments.length > 1) {
        try {
          segments = await diarizeSpeakers(
            segments,
            meta.userName,
            meta.speakerEvents,
            participantNames
          );
        } catch {
          // diarization is optional, continue without it
        }
      }

      return { ...result, segments };
    },
    onSuccess: async (data: Transcription) => {
      if (!recordingId) return;
      const meta = await getRecording(recordingId);
      if (meta) {
        meta.transcription = data;
        await saveRecording(meta);
      }
      qc.invalidateQueries({ queryKey: ["transcription", recordingId] });
    },
  });

  const transcribeSavedRecording = async () => {
    if (!recordingId) throw new Error("No recording ID");
    const file = await getRecordingAudioFile(recordingId);
    transcribeMutation.mutate(file);
  };

  return {
    transcription,
    transcribe: transcribeMutation.mutate,
    transcribeSavedRecording,
    isTranscribing: transcribeMutation.isPending,
    transcriptionError: transcribeMutation.error,
  };
}
