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
  { id: "openai", label: "OpenAI", link: "https://platform.openai.com/api-keys", summary: "Industry standard models.", caps: "Transcription & Summary" },
  { id: "anthropic", label: "Anthropic", link: "https://console.anthropic.com/settings/keys", summary: "Excellent reasoning and writing.", caps: "Summary only" },
  { id: "gemini", label: "Google Gemini", link: "https://aistudio.google.com/app/apikey", summary: "Google's fast multimodal models.", caps: "Transcription & Summary" },
  { id: "groq", label: "Groq", link: "https://console.groq.com/keys", summary: "Ultra-fast inference via LPU.", caps: "Transcription & Summary" },
  { id: "together", label: "Together AI", link: "https://api.together.ai/settings/api-keys", summary: "Open Source Llama & DeepSeek.", caps: "Summary only" },
  { id: "deepgram", label: "Deepgram", link: "https://console.deepgram.com/", summary: "Lightning-fast voice API.", caps: "Transcription only" },
];

const selectClass =
  "w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded-md text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/20 transition-colors text-gray-300";

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

  const toggleCloudProviders = (enabled: boolean) => {
    setSettings((s) => {
      const updates: Partial<Settings> = { enableCloudProviders: enabled };
      if (!enabled) {
        updates.transcriptionProvider = "local";
        updates.transcriptionModel = getTranscriptionModels("local")[0]?.id || "onnx-community/whisper-tiny";
        updates.summarizationProvider = "local";
        updates.summarizationModel = getChatModels("local")[0]?.id || "onnx-community/Qwen2.5-0.5B-Instruct";
      }
      return { ...s, ...updates } as Settings;
    });
  };

  const configuredProviders = settings.enableCloudProviders
    ? API_PROVIDERS.filter(
        (p) =>
          settings.providers[p.id] &&
          settings.providersEnabled?.[p.id as keyof typeof settings.providersEnabled] !== false
      ).map((p) => p.id)
    : [];

  const transcriptionProviders = getProvidersWithCapability("transcription").filter(
    (p) => configuredProviders.includes(p) || p === "local"
  );
  const summarizationProviders = getProvidersWithCapability("chat").filter(
    (p) => configuredProviders.includes(p) || p === "local"
  );

  const transcriptionModels = getTranscriptionModels(settings.transcriptionProvider);
  const summarizationModels = getChatModels(settings.summarizationProvider);

  return (
    <div className="max-w-md space-y-6 animate-fade-in">

      {/* ── Local AI Models ── */}
      <section>
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
          Local AI Models
        </h3>
        <p className="text-[11px] text-gray-500 mb-3">
          Runs 100% on your device — private &amp; free. Model files are downloaded once and cached automatically the first time you transcribe or summarize.
        </p>

        <div className="space-y-3 bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
          {/* Transcription model */}
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Transcription model</label>
            <select
              value={settings.transcriptionProvider === "local" ? settings.transcriptionModel : ""}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  transcriptionProvider: "local",
                  transcriptionModel: e.target.value,
                }))
              }
              className={selectClass}
            >
              {getTranscriptionModels("local").map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.sizeMB ? ` — ~${m.sizeMB} MB` : ""}
                  {m.isRecommended ? " ⭐" : ""}
                </option>
              ))}
            </select>
            {/* Description of selected model */}
            {(() => {
              const m = getTranscriptionModels("local").find(
                (x) => x.id === settings.transcriptionModel
              );
              return m?.description ? (
                <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">{m.description}</p>
              ) : null;
            })()}
          </div>

          {/* Summarization model */}
          <div className="pt-3 border-t border-gray-800/60">
            <label className="block text-sm text-gray-300 mb-1.5">Summarization model</label>
            <select
              value={settings.summarizationProvider === "local" ? settings.summarizationModel : ""}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  summarizationProvider: "local",
                  summarizationModel: e.target.value,
                }))
              }
              className={selectClass}
            >
              <optgroup label="⚡ Ultra-light (fast, smaller)">
                {getChatModels("local")
                  .filter((m) => m.tier === "ultra-light")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                      {m.sizeMB ? ` — ~${m.sizeMB} MB` : ""}
                      {m.isRecommended ? " ⭐" : ""}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="🧠 Standard (better quality)">
                {getChatModels("local")
                  .filter((m) => m.tier === "standard")
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                      {m.sizeMB ? ` — ~${m.sizeMB} MB` : ""}
                    </option>
                  ))}
              </optgroup>
            </select>
            {(() => {
              const m = getChatModels("local").find(
                (x) => x.id === settings.summarizationModel
              );
              return m?.description ? (
                <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">{m.description}</p>
              ) : null;
            })()}
          </div>
        </div>
      </section>

      {/* ── Cloud API Providers ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Cloud API Providers
            </h3>
            <p className="text-[11px] text-gray-500 mt-1">
              Optional — use cloud models instead of local AI.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer ml-4">
            <input
              type="checkbox"
              checked={settings.enableCloudProviders}
              onChange={(e) => toggleCloudProviders(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-7 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:bg-green-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-3" />
          </label>
        </div>

        {settings.enableCloudProviders && (
          <div className="space-y-2.5 animate-in slide-in-from-top-2 fade-in duration-200">
            {API_PROVIDERS.map((p) => (
              <div key={p.id} className="bg-gray-900/40 rounded-lg p-3 border border-gray-800/60">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-gray-200">{p.label}</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          settings.providersEnabled?.[p.id as keyof typeof settings.providersEnabled] !== false
                        }
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
                    Get key →
                  </a>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-gray-400 flex-1">{p.summary}</p>
                  <span className="text-[10px] text-gray-500 font-medium bg-gray-800 px-1.5 py-0.5 rounded ml-2">
                    {p.caps}
                  </span>
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
        )}

        {/* Active cloud model overrides — only shown when cloud is enabled and providers are configured */}
        {settings.enableCloudProviders && configuredProviders.length > 0 && (
          <div className="mt-3 space-y-3 bg-gray-900/50 rounded-lg p-4 border border-gray-800/50">
            <p className="text-[11px] text-gray-400 font-medium">Active cloud models</p>

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Transcription</label>
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
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
              {transcriptionModels.length > 1 && (
                <select
                  value={settings.transcriptionModel}
                  onChange={(e) => setSettings((s) => ({ ...s, transcriptionModel: e.target.value }))}
                  className={`${selectClass} mt-1.5`}
                >
                  {transcriptionModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Summarization</label>
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
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
              {summarizationModels.length > 1 && (
                <select
                  value={settings.summarizationModel}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, summarizationModel: e.target.value }))
                  }
                  className={`${selectClass} mt-1.5`}
                >
                  {summarizationModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Recording ── */}
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
