import { useState } from "react";

export function SummaryView({ summary }: { summary?: string }) {
  const [copied, setCopied] = useState(false);

  if (!summary) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Summary</h3>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="bg-gray-900/50 border border-gray-800/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-300">
        {summary}
      </div>
    </div>
  );
}
