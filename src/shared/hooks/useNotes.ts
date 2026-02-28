import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sendToBackground } from "../messages";
import { getRecording } from "../storage/metadata";
import type { Note } from "../types";

export function useNotes(recordingId: string | undefined) {
  const qc = useQueryClient();

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", recordingId],
    queryFn: async () => {
      if (!recordingId) return [];
      const meta = await getRecording(recordingId);
      return meta?.notes ?? [];
    },
    enabled: !!recordingId,
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const result = await sendToBackground<{ note?: Note; error?: string }>({
        type: "ADD_NOTE",
        text,
      });
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes", recordingId] });
    },
  });

  return { notes, addNote: addNote.mutate, isAdding: addNote.isPending };
}
