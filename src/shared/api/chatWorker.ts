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
// WASM multi-threading requires SharedArrayBuffer (needs Cross-Origin Isolation).
// Fall back to single-threaded if SAB is not available to avoid Aborted() crash.
const canMultiThread = typeof SharedArrayBuffer !== 'undefined';
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
        return { maxPromptChars: 1200, maxNewTokens: 256, timeoutMs: 45_000 };
    }
    if (m.includes("0.5b") || m.includes("0_5b")) {
        return { maxPromptChars: 2400, maxNewTokens: 384, timeoutMs: 60_000 };
    }
    if (m.includes("tinyllama") || m.includes("1.1b") || m.includes("1_1b")) {
        return { maxPromptChars: 3000, maxNewTokens: 512, timeoutMs: 90_000 };
    }
    if (m.includes("1.7b") || m.includes("1_7b")) {
        return { maxPromptChars: 4000, maxNewTokens: 768, timeoutMs: 120_000 };
    }
    // Fallback for unknown models
    return { maxPromptChars: 3000, maxNewTokens: 512, timeoutMs: 90_000 };
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
                    // Sampling with low temperature prevents greedy repetition loops
                    do_sample: true,
                    temperature: 0.2,
                    top_p: 0.9,
                    // Penalise repeating the same tokens — key fix for "runs forever"
                    repetition_penalty: 1.3,
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

            let outputText = (result as any)[0].generated_text;
            if (Array.isArray(outputText)) {
                outputText = outputText[outputText.length - 1].content || "";
            } else if (typeof outputText === "string") {
                outputText = outputText.trim();
            }

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
