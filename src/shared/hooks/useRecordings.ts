import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllRecordings, deleteRecording as deleteMeta } from "../storage/metadata";

export function useRecordings() {
  const qc = useQueryClient();

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ["recordings"],
    queryFn: getAllRecordings,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteMeta(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recordings"] }),
  });

  return { recordings, isLoading, deleteRecording: remove.mutate };
}
