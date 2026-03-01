import { useState, useEffect } from "react";
import { getSettings, saveSettings } from "@shared/storage/settings";
import type { Settings } from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/types";
import { TRANSCRIPTION_MODELS, SUMMARIZATION_MODELS } from "@shared/api/models";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (key: keyof Settings, value: string | boolean) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const selectClass =
    "w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded-md text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/20 transition-colors text-gray-300";

  return (
    <div className="max-w-md space-y-6 animate-fade-in">
      {/* API Keys Section */}
      <section>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">API Keys</h3>
        <div className="space-y-3 bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">OpenAI API Key</label>
            <input
              type="password"
              value={settings.whisperApiKey}
              onChange={(e) => update("whisperApiKey", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded-md text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/20 transition-colors placeholder:text-gray-600"
              placeholder="sk-..."
            />
            <p className="text-xs text-gray-600 mt-1">Used for Whisper transcription</p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Anthropic API Key</label>
            <input
              type="password"
              value={settings.claudeApiKey}
              onChange={(e) => update("claudeApiKey", e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded-md text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/20 transition-colors placeholder:text-gray-600"
              placeholder="sk-ant-..."
            />
            <p className="text-xs text-gray-600 mt-1">Used for Claude summarization</p>
          </div>
        </div>
      </section>

      {/* Models Section */}
      <section>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Models</h3>
        <div className="space-y-3 bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Transcription Model</label>
            <select
              value={settings.whisperModel}
              onChange={(e) => update("whisperModel", e.target.value)}
              className={selectClass}
            >
              {TRANSCRIPTION_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Summarization Model</label>
            <select
              value={settings.claudeModel}
              onChange={(e) => update("claudeModel", e.target.value)}
              className={selectClass}
            >
              {SUMMARIZATION_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Recording Section */}
      <section>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Recording</h3>
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-gray-300">Capture microphone</p>
              <p className="text-xs text-gray-600 mt-0.5">Record your voice alongside tab audio</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={settings.captureMic}
                onChange={(e) => update("captureMic", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:bg-red-600 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </div>
          </label>
        </div>
      </section>

      <button
        onClick={handleSave}
        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
          saved
            ? "bg-green-600/20 text-green-400 border border-green-800/50"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}
