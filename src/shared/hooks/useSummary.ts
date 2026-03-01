import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { summarizeTranscript } from "../api/providers";
import { getRecording, saveRecording } from "../storage/metadata";

export function useSummary(recordingId: string | undefined) {
  const qc = useQueryClient();

  const { data: summary } = useQuery({
    queryKey: ["summary", recordingId],
    queryFn: async () => {
      if (!recordingId) return null;
      const meta = await getRecording(recordingId);
      return meta?.summary ?? null;
    },
    enabled: !!recordingId,
  });

  const summarize = useMutation({
    mutationFn: async () => {
      if (!recordingId) throw new Error("No recording");
      const meta = await getRecording(recordingId);
      if (!meta?.transcription) throw new Error("Transcription required first");
      return summarizeTranscript(
        meta.transcription,
        meta.notes.map((n) => n.text),
        { duration: meta.duration, platform: meta.platform }
      );
    },
    onSuccess: async (data: string) => {
      if (!recordingId) return;
      const meta = await getRecording(recordingId);
      if (meta) {
        meta.summary = data;
        await saveRecording(meta);
      }
      qc.invalidateQueries({ queryKey: ["summary", recordingId] });
    },
  });

  return {
    summary,
    summarize: summarize.mutate,
    isSummarizing: summarize.isPending,
    summaryError: summarize.error,
  };
}
