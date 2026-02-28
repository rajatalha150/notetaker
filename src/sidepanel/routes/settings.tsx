import { useState, useEffect } from "react";
import { getSettings, saveSettings } from "@shared/storage/settings";
import type { Settings } from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/types";

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

  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-semibold">Settings</h2>

      <div>
        <label className="block text-sm text-gray-400 mb-1">OpenAI API Key (Whisper)</label>
        <input
          type="password"
          value={settings.whisperApiKey}
          onChange={(e) => update("whisperApiKey", e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-gray-500"
          placeholder="sk-..."
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Anthropic API Key (Claude)</label>
        <input
          type="password"
          value={settings.claudeApiKey}
          onChange={(e) => update("claudeApiKey", e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-gray-500"
          placeholder="sk-ant-..."
        />
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={settings.captureMic}
            onChange={(e) => update("captureMic", e.target.checked)}
            className="rounded"
          />
          Capture microphone audio
        </label>
      </div>

      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
      >
        {saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}
