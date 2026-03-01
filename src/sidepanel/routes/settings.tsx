import { useState, useEffect } from "react";
import { getSettings, saveSettings } from "@shared/storage/settings";
import type { Settings, Provider } from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/types";
import { getTranscriptionModels, getChatModels, getProvidersWithCapability } from "@shared/api/models";

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  groq: "Groq",
};

const PROVIDER_PLACEHOLDERS: Record<Provider, string> = {
  openai: "sk-...",
  anthropic: "sk-ant-...",
  gemini: "AI...",
  groq: "gsk_...",
};

const ALL_PROVIDERS: Provider[] = ["openai", "anthropic", "gemini", "groq"];

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

  const updateProvider = (provider: Provider, value: string) => {
    setSettings((s) => ({
      ...s,
      providers: { ...s.providers, [provider]: value || undefined },
    }));
  };

  const configuredProviders = ALL_PROVIDERS.filter((p) => settings.providers[p]);

  const transcriptionProviders = getProvidersWithCapability("transcription").filter((p) => configuredProviders.includes(p));
  const summarizationProviders = getProvidersWithCapability("chat").filter((p) => configuredProviders.includes(p));

  const transcriptionModels = getTranscriptionModels(settings.transcriptionProvider);
  const summarizationModels = getChatModels(settings.summarizationProvider);

  const inputClass =
    "w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded-md text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/20 transition-colors placeholder:text-gray-600";
  const selectClass =
    "w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded-md text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/20 transition-colors text-gray-300";

  return (
    <div className="max-w-md space-y-6 animate-fade-in">
      {/* API Keys Section */}
      <section>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">API Keys</h3>
        <div className="space-y-3 bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
          {ALL_PROVIDERS.map((provider) => (
            <div key={provider}>
              <label className="block text-sm text-gray-300 mb-1.5">{PROVIDER_LABELS[provider]}</label>
              <input
                type="password"
                value={settings.providers[provider] ?? ""}
                onChange={(e) => updateProvider(provider, e.target.value)}
                className={inputClass}
                placeholder={PROVIDER_PLACEHOLDERS[provider]}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Transcription Section */}
      <section>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Transcription</h3>
        <div className="space-y-3 bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Provider</label>
            {transcriptionProviders.length === 0 ? (
              <p className="text-xs text-yellow-500">Add an OpenAI or Groq API key to enable transcription</p>
            ) : (
              <select
                value={settings.transcriptionProvider}
                onChange={(e) => {
                  const p = e.target.value as Provider;
                  const models = getTranscriptionModels(p);
                  setSettings((s) => ({
                    ...s,
                    transcriptionProvider: p,
                    transcriptionModel: models[0]?.id ?? "",
                  }));
                }}
                className={selectClass}
              >
                {transcriptionProviders.map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                ))}
              </select>
            )}
          </div>
          {transcriptionProviders.length > 0 && (
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Model</label>
              <select
                value={settings.transcriptionModel}
                onChange={(e) => setSettings((s) => ({ ...s, transcriptionModel: e.target.value }))}
                className={selectClass}
              >
                {transcriptionModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Summarization Section */}
      <section>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Summarization</h3>
        <div className="space-y-3 bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Provider</label>
            {summarizationProviders.length === 0 ? (
              <p className="text-xs text-yellow-500">Add an API key to enable summarization</p>
            ) : (
              <select
                value={settings.summarizationProvider}
                onChange={(e) => {
                  const p = e.target.value as Provider;
                  const models = getChatModels(p);
                  setSettings((s) => ({
                    ...s,
                    summarizationProvider: p,
                    summarizationModel: models[0]?.id ?? "",
                  }));
                }}
                className={selectClass}
              >
                {summarizationProviders.map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                ))}
              </select>
            )}
          </div>
          {summarizationProviders.length > 0 && (
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Model</label>
              <select
                value={settings.summarizationModel}
                onChange={(e) => setSettings((s) => ({ ...s, summarizationModel: e.target.value }))}
                className={selectClass}
              >
                {summarizationModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
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
                onChange={(e) => setSettings((s) => ({ ...s, captureMic: e.target.checked }))}
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
