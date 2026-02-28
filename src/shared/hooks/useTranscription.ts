import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transcribeAudio } from "../api/whisper";
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

  const transcribe = useMutation({
    mutationFn: async (file: File) => {
      return transcribeAudio(file);
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
    transcribe: transcribe.mutate,
    isTranscribing: transcribe.isPending,
    transcriptionError: transcribe.error,
  };
}
