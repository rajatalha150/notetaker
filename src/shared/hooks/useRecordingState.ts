import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { sendToBackground, type StatusResponse, type BroadcastEvent } from "../messages";

export function useRecordingState() {
  const qc = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["recording-status"],
    queryFn: () => sendToBackground<StatusResponse>({ type: "GET_STATUS" }),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "recording" ? 1000 : false;
    },
  });

  useEffect(() => {
    const listener = (msg: BroadcastEvent) => {
      if (
        msg.type === "RECORDING_STARTED" ||
        msg.type === "RECORDING_STOPPED" ||
        msg.type === "RECORDING_PAUSED" ||
        msg.type === "RECORDING_RESUMED"
      ) {
        qc.invalidateQueries({ queryKey: ["recording-status"] });
        if (msg.type === "RECORDING_STOPPED") {
          qc.invalidateQueries({ queryKey: ["recordings"] });
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [qc]);

  const startRecording = useCallback(async (tabId: number, captureMic: boolean) => {
    await sendToBackground({ type: "START_RECORDING", tabId, captureMic });
  }, []);

  const stopRecording = useCallback(async () => {
    await sendToBackground({ type: "STOP_RECORDING" });
  }, []);

  const pauseRecording = useCallback(async () => {
    await sendToBackground({ type: "PAUSE_RECORDING" });
  }, []);

  const resumeRecording = useCallback(async () => {
    await sendToBackground({ type: "RESUME_RECORDING" });
  }, []);

  return {
    status: status?.status ?? "idle",
    recordingId: status?.recordingId,
    startedAt: status?.startedAt,
    duration: status?.duration ?? 0,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
