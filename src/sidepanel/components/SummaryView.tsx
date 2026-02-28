export function SummaryView({ summary }: { summary?: string }) {
  if (!summary) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Summary</h3>
        <button
          onClick={() => navigator.clipboard.writeText(summary)}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          Copy
        </button>
      </div>
      <div className="bg-gray-900 rounded-lg p-3 text-sm whitespace-pre-wrap">
        {summary}
      </div>
    </div>
  );
}
