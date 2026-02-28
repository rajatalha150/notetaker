import { useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { getRecording } from "@shared/storage/metadata";
import { useTranscription } from "@shared/hooks/useTranscription";
import { useSummary } from "@shared/hooks/useSummary";
import { NotesEditor } from "../components/NotesEditor";
import { TranscriptionView } from "../components/TranscriptionView";
import { SummaryView } from "../components/SummaryView";

export function RecordingDetailPage() {
  const { id } = useParams({ from: "/recording/$id" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: recording } = useQuery({
    queryKey: ["recording", id],
    queryFn: () => getRecording(id),
  });

  const { transcription, transcribe, isTranscribing, transcriptionError } = useTranscription(id);
  const { summary, summarize, isSummarizing, summaryError } = useSummary(id);

  if (!recording) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  const durationSec = Math.floor(recording.duration / 1000);
  const min = Math.floor(durationSec / 60);
  const sec = durationSec % 60;

  const handleTranscribe = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) transcribe(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to recordings
      </Link>

      <div>
        <h2 className="text-lg font-semibold">{recording.title}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">
            {new Date(recording.startedAt).toLocaleString()}
          </span>
          <span className="text-xs text-gray-700">&middot;</span>
          <span className="text-xs text-gray-500">{min}m {sec}s</span>
          {recording.platform && (
            <>
              <span className="text-xs text-gray-700">&middot;</span>
              <span className="text-xs px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">{recording.platform}</span>
            </>
          )}
        </div>
        {recording.filename && (
          <p className="text-xs text-gray-600 mt-1.5">
            Saved as: {recording.filename}
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="flex gap-2">
        <button
          onClick={handleTranscribe}
          disabled={isTranscribing || !!transcription}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            transcription
              ? "bg-blue-900/20 text-blue-400 border border-blue-800/30"
              : isTranscribing
              ? "bg-blue-600/50 text-white"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          } disabled:cursor-default`}
        >
          {isTranscribing && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {isTranscribing ? "Transcribing..." : transcription ? "Transcribed" : "Transcribe"}
        </button>
        <button
          onClick={() => summarize()}
          disabled={isSummarizing || !transcription || !!summary}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            summary
              ? "bg-purple-900/20 text-purple-400 border border-purple-800/30"
              : isSummarizing
              ? "bg-purple-600/50 text-white"
              : "bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40"
          } disabled:cursor-default`}
        >
          {isSummarizing && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {isSummarizing ? "Summarizing..." : summary ? "Summarized" : "Summarize"}
        </button>
      </div>

      {!transcription && !isTranscribing && (
        <p className="text-xs text-gray-600">
          Select the downloaded recording file to transcribe it.
        </p>
      )}

      {transcriptionError && (
        <p className="text-xs text-red-400">{transcriptionError.message}</p>
      )}
      {summaryError && (
        <p className="text-xs text-red-400">{summaryError.message}</p>
      )}

      <SummaryView summary={summary ?? undefined} />
      <TranscriptionView transcription={transcription ?? undefined} />
      <NotesEditor notes={recording.notes} />
    </div>
  );
}
