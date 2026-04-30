import { pipeline, env } from "@huggingface/transformers";

// Disable local models since we download from HF
env.allowLocalModels = false;
env.useBrowserCache = true;

// WASM backend config (used as fallback when WebGPU is unavailable)
const safeEnv = env as any;
if (!safeEnv.backends) safeEnv.backends = {};
if (!safeEnv.backends.onnx) safeEnv.backends.onnx = {};
if (!safeEnv.backends.onnx.wasm) safeEnv.backends.onnx.wasm = {};
safeEnv.backends.onnx.wasm.wasmPaths = new URL("../ort-wasm/", import.meta.url).toString();

const isPackagedFileWorker =
    typeof self !== "undefined" &&
    typeof self.location?.protocol === "string" &&
    self.location.protocol === "file:";

// WASM multi-threading requires SharedArrayBuffer (needs Cross-Origin Isolation).
// Fall back to single-threaded if SAB is not available to avoid Aborted() crash.
// Also stay single-threaded in packaged Electron `file:` workers because the
// threaded ONNX runtime helper worker is not emitted next to the bundled worker asset.
const canMultiThread = typeof SharedArrayBuffer !== 'undefined' && !isPackagedFileWorker;
const maxThreads = canMultiThread && typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? Math.min(navigator.hardwareConcurrency, 4)
    : 1;
safeEnv.backends.onnx.wasm.numThreads = maxThreads;

/** Detect whether WebGPU is available in this worker context */
async function hasWebGPU(): Promise<boolean> {
    try {
        if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;
        const adapter = await (navigator as any).gpu.requestAdapter();
        return adapter !== null;
    } catch {
        return false;
    }
}

type DeviceConfig = { device: "webgpu" | "wasm"; dtype: "fp16" | "fp32" | "q4" | "q8" };

async function resolveDevice(): Promise<DeviceConfig> {
    if (await hasWebGPU()) {
        return { device: "webgpu", dtype: "fp16" };
    }
    return { device: "wasm", dtype: "q4" };
}

/** Per-model context limits (tokens) and generation caps.
 *  ~2048 ctx  → 360M, 0.5B class
 *  ~4096 ctx  → 1.1B–1.7B class
 *  Rough estimate: 1 token ≈ 4 chars for English text.
 */
function getModelProfile(model: string): {
    maxPromptChars: number;
    maxNewTokens: number;
    timeoutMs: number;
} {
    const m = model.toLowerCase();
    if (m.includes("360m") || m.includes("135m")) {
        return { maxPromptChars: 1200, maxNewTokens: 256, timeoutMs: 180_000 }; // 3 min
    }
    if (m.includes("0.5b") || m.includes("0_5b")) {
        return { maxPromptChars: 2400, maxNewTokens: 384, timeoutMs: 240_000 }; // 4 min
    }
    if (m.includes("tinyllama") || m.includes("1.1b") || m.includes("1_1b")) {
        return { maxPromptChars: 3000, maxNewTokens: 512, timeoutMs: 300_000 }; // 5 min
    }
    if (m.includes("1.7b") || m.includes("1_7b")) {
        return { maxPromptChars: 4000, maxNewTokens: 768, timeoutMs: 420_000 }; // 7 min
    }
    // Fallback for unknown models
    return { maxPromptChars: 3000, maxNewTokens: 512, timeoutMs: 300_000 };
}

function normalizeGeneratedText(result: any): string {
    const generated = result?.[0]?.generated_text;

    if (typeof generated === "string") {
        return generated.trim();
    }

    if (Array.isArray(generated)) {
        const last = generated[generated.length - 1];
        if (typeof last === "string") return last.trim();
        if (last && typeof last.content === "string") return last.content.trim();
        if (Array.isArray(last?.content)) {
            return last.content
                .map((item: any) => typeof item?.text === "string" ? item.text : "")
                .join("")
                .trim();
        }
    }

    if (generated && typeof generated === "object") {
        if (typeof generated.text === "string") return generated.text.trim();
        if (typeof generated.content === "string") return generated.content.trim();
    }

    return "";
}

class PipelineSingleton {
    static instance: any = null;
    static currentModel: string | null = null;
    static loading: Promise<any> | null = null;

    static async getInstance(model: string, progress_callback?: (o: any) => void) {
        if (this.currentModel && this.currentModel !== model) {
            if (this.instance) {
                try { await this.instance.dispose(); } catch { /* best effort */ }
            }
            this.instance = null;
            this.loading = null;
            this.currentModel = null;
        }

        if (this.instance) return this.instance;
        if (this.loading) return this.loading;

        this.loading = (async () => {
            try {
                const { device, dtype } = await resolveDevice();
                self.postMessage({ type: "device", device });

                const inst = await pipeline("text-generation", model, {
                    progress_callback,
                    device,
                    dtype,
                });
                this.instance = inst;
                this.currentModel = model;
                this.loading = null;
                return inst;
            } catch (error) {
                this.instance = null;
                this.currentModel = null;
                this.loading = null;
                throw error;
            }
        })();

        return this.loading;
    }

    static async dispose() {
        if (this.instance) {
            try { await this.instance.dispose(); } catch { /* best effort */ }
            this.instance = null;
            this.currentModel = null;
            this.loading = null;
        }
    }
}

self.addEventListener("message", async (e: MessageEvent) => {
    const { type, messages, model } = e.data;

    if (type === "chat") {
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        try {
            self.postMessage({ type: "status", status: "loading", model });

            const generator = await PipelineSingleton.getInstance(model, (progress: any) => {
                self.postMessage({ type: "progress", progress });
            });

            self.postMessage({ type: "status", status: "generating", model });

            const { maxNewTokens, timeoutMs } = getModelProfile(model);

            // Race generation against a hard timeout to prevent infinite loops
            const result = await Promise.race([
                generator(messages, {
                    max_new_tokens: maxNewTokens,
                    // Greedy search (fastest) but explicitly penalize repeated phrases to break loops
                    do_sample: false,
                    repetition_penalty: 1.15,
                    return_full_text: false,
                }),
                new Promise<never>((_, reject) => {
                    timeoutHandle = setTimeout(() => {
                        reject(new Error(
                            `Summarization timed out after ${timeoutMs / 1000}s. ` +
                            `Try a smaller model or shorter transcript.`
                        ));
                    }, timeoutMs);
                }),
            ]);

            if (timeoutHandle !== null) clearTimeout(timeoutHandle);

            const outputText = normalizeGeneratedText(result);

            if (!outputText) {
                throw new Error("Model returned an empty response. Try a different model.");
            }

            self.postMessage({ type: "done", result: outputText });
        } catch (error: any) {
            if (timeoutHandle !== null) clearTimeout(timeoutHandle);
            self.postMessage({ type: "error", error: error.message || String(error) });
        }

    } else if (type === "preload") {
        try {
            await PipelineSingleton.getInstance(model, (progress: any) => {
                self.postMessage({ type: "progress", progress });
            });
            self.postMessage({ type: "preload_done", model });
        } catch (error: any) {
            self.postMessage({ type: "error", error: error.message || String(error) });
        }

    } else if (type === "dispose") {
        await PipelineSingleton.dispose();
        self.postMessage({ type: "disposed" });
    }
});
