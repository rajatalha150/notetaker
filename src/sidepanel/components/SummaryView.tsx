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
      <div
        className="bg-gray-900/50 border border-gray-800/50 rounded-lg p-4 text-sm leading-relaxed text-gray-300 prose prose-invert prose-sm max-w-none prose-headings:text-gray-200 prose-headings:text-sm prose-headings:font-medium prose-headings:mt-3 prose-headings:mb-1 prose-li:my-0 prose-ul:my-1 prose-p:my-1"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
      />
    </div>
  );
}

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}
