import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transcribe, diarizeSpeakers } from "../api/providers";
import { getRecording, saveRecording } from "../storage/metadata";
import { getRecordingAudioFile } from "../recording-assets";
import type { Transcription } from "../types";

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
      const result = await transcribe(audio);
      try {
        if (!recordingId) throw new Error("No recording ID");
        const meta = await getRecording(recordingId);
        const diarized = await diarizeSpeakers(
          result.segments, 
          meta?.userName, 
          meta?.speakerEvents,
          meta?.participantNames
        );
        return { ...result, segments: diarized };
      } catch {
        return result;
      }
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
