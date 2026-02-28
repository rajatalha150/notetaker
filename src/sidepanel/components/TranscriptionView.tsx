import type { Transcription } from "@shared/types";

export function TranscriptionView({ transcription }: { transcription?: Transcription }) {
  if (!transcription) return null;

  const copyText = () => navigator.clipboard.writeText(transcription.fullText);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Transcript</h3>
        <button onClick={copyText} className="text-xs text-gray-400 hover:text-gray-200">
          Copy
        </button>
      </div>
      <div className="bg-gray-900 rounded-lg p-3 max-h-64 overflow-y-auto space-y-1.5">
        {transcription.segments.map((seg, i) => (
          <p key={i} className="text-sm">
            <span className="text-xs text-gray-500 font-mono mr-2">
              {formatTime(seg.start)}
            </span>
            {seg.text}
          </p>
        ))}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
