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
  together: "Together AI",
  deepgram: "Deepgram",
  local: "Local (On-Device)",
};

const PROVIDER_PLACEHOLDERS: Record<Provider, string> = {
  openai: "sk-...",
  anthropic: "sk-ant-...",
  gemini: "AI...",
  groq: "gsk_...",
  together: "Bearer...",
  deepgram: "Token...",
  local: "",
};

const API_PROVIDERS: { id: Provider; label: string; link: string; summary: string; caps: string }[] = [
  { id: "openai", label: "OpenAI", link: "https://platform.openai.com/api-keys", summary: "Industry standard models.", caps: "✅ Transcription & Summary" },
  { id: "anthropic", label: "Anthropic", link: "https://console.anthropic.com/settings/keys", summary: "Excellent reasoning and writing.", caps: "✅ Summary Only" },
  { id: "gemini", label: "Google Gemini", link: "https://aistudio.google.com/app/apikey", summary: "Google's fast multimodal models.", caps: "✅ Transcription & Summary" },
  { id: "groq", label: "Groq", link: "https://console.groq.com/keys", summary: "Ultra-fast inference via LPU.", caps: "✅ Transcription & Summary" },
  { id: "together", label: "Together AI", link: "https://api.together.ai/settings/api-keys", summary: "Open Source Llama & DeepSeek.", caps: "✅ Summary Only" },
  { id: "deepgram", label: "Deepgram", link: "https://console.deepgram.com/", summary: "Lightning-fast voice API.", caps: "✅ Transcription Only" },
];

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

  const updateProviderEnabled = (provider: Provider, enabled: boolean) => {
    setSettings((s) => ({
      ...s,
      providersEnabled: { ...(s.providersEnabled || {}), [provider]: enabled },
    }));
  };

  const configuredProviders = API_PROVIDERS.filter(
    (p) => settings.providers[p.id] && settings.providersEnabled?.[p.id as keyof typeof settings.providersEnabled] !== false
  ).map((p) => p.id);

  const transcriptionProviders = getProvidersWithCapability("transcription").filter((p) => configuredProviders.includes(p) || p === "local");
  const summarizationProviders = getProvidersWithCapability("chat").filter((p) => configuredProviders.includes(p) || p === "local");

  const transcriptionModels = getTranscriptionModels(settings.transcriptionProvider);
  const summarizationModels = getChatModels(settings.summarizationProvider);

  const selectClass =
    "w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded-md text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/20 transition-colors text-gray-300";

  return (
    <div className="max-w-md space-y-6 animate-fade-in">
      <section>
        <div className="mb-3">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">API Keys Setup</h3>
          <p className="text-[11px] text-gray-500 mt-1">Configure your active API keys. You can use different providers for transcribing audio and generating summaries.</p>
        </div>

        <div className="space-y-2.5">
          {API_PROVIDERS.map((p) => (
            <div key={p.id} className="bg-gray-900/40 rounded-lg p-3 border border-gray-800/60">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-200">{p.label}</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.providersEnabled?.[p.id as keyof typeof settings.providersEnabled] !== false}
                      onChange={(e) => updateProviderEnabled(p.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-7 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:bg-green-600 transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-3" />
                  </label>
                </div>
                <a
                  href={p.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-2 py-0.5 rounded-full"
                >
                  Get API Key &rarr;
                </a>
              </div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-gray-400 flex-1">{p.summary}</p>
                <span className="text-[10px] items-center text-gray-500 font-medium bg-gray-800 px-1.5 py-0.5 rounded ml-2">{p.caps}</span>
              </div>
              <input
                type="password"
                value={settings.providers[p.id] ?? ""}
                onChange={(e) => updateProvider(p.id, e.target.value)}
                className="w-full px-2.5 py-1.5 bg-gray-950/50 border border-gray-700/50 rounded text-xs focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/20 transition-colors placeholder:text-gray-600 font-mono"
                placeholder={PROVIDER_PLACEHOLDERS[p.id]}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Active Transcription AI</h3>
        <div className="space-y-3 bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Transcription Provider</label>
            {transcriptionProviders.length === 0 ? (
              <p className="text-xs text-yellow-500">Provide an API key to enable cloud transcription.</p>
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
              {settings.transcriptionProvider === "local" && (
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  <strong>Local mode:</strong> The AI model runs <i>entirely inside your browser</i>.
                  It's 100% private and free. The first transcription will download the model (~40-80MB) automatically.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Active Summarization AI</h3>
        <div className="space-y-3 bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Summarization Provider</label>
            {summarizationProviders.length === 0 ? (
              <p className="text-xs text-yellow-500">Provide an API key above to enable meeting summaries. (Local summarization is available)</p>
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
              {settings.summarizationProvider === "local" && (
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  <strong>Local mode:</strong> The AI runs <i>entirely inside your browser</i> privately.
                  However, text models are large. The first run will download <strong>~350MB-2GB</strong> of data and may take several minutes to process.
                </p>
              )}
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
        className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${saved
          ? "bg-green-600/20 text-green-400 border border-green-800/50"
          : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
      >
        {saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}
