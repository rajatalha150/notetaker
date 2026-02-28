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

  if (!recording) return <p className="text-sm text-gray-500">Loading...</p>;

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
    <div className="space-y-4">
      <Link to="/" className="text-sm text-gray-400 hover:text-gray-200">&larr; Back</Link>

      <div>
        <h2 className="text-lg font-semibold">{recording.title}</h2>
        <p className="text-xs text-gray-500">
          {new Date(recording.startedAt).toLocaleString()} &middot; {min}m {sec}s
          {recording.platform && ` \u00B7 ${recording.platform}`}
        </p>
        {recording.filename && (
          <p className="text-xs text-gray-600 mt-1">
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
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm transition-colors"
        >
          {isTranscribing ? "Transcribing..." : transcription ? "Transcribed" : "Transcribe"}
        </button>
        <button
          onClick={() => summarize()}
          disabled={isSummarizing || !transcription || !!summary}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-sm transition-colors"
        >
          {isSummarizing ? "Summarizing..." : summary ? "Summarized" : "Summarize"}
        </button>
      </div>

      {!transcription && (
        <p className="text-xs text-gray-500">
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
