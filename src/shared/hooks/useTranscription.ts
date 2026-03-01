import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transcribe, diarizeSpeakers } from "../api/providers";
import { getRecording, saveRecording } from "../storage/metadata";
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
    mutationFn: async (file: File) => {
      const result = await transcribe(file);
      try {
        const diarized = await diarizeSpeakers(result.segments);
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

  return {
    transcription,
    transcribe: transcribeMutation.mutate,
    isTranscribing: transcribeMutation.isPending,
    transcriptionError: transcribeMutation.error,
  };
}
