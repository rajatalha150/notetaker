import { pipeline, env } from "@huggingface/transformers";

// Disable local models since we download from HF
env.allowLocalModels = false;
env.useBrowserCache = true;

// WASM backend config (fallback when WebGPU unavailable)
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
        // WebGPU: fp32 for Whisper gives best accuracy (q8 on WASM, fp32 on GPU is standard)
        return { device: "webgpu", dtype: "fp32" };
    }
    // WASM fallback: q8 = good quality/speed balance for Whisper (better than q4 for ASR)
    return { device: "wasm", dtype: "q8" };
}

class PipelineSingleton {
    static instance: any = null;
    static currentModel: string | null = null;
    static loading: Promise<any> | null = null;

    static async getInstance(model: string, progress_callback?: (o: any) => void) {
        // If the model changed, dispose the old pipeline and create a new one
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

                const inst = await pipeline("automatic-speech-recognition", model, {
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
}

self.addEventListener("message", async (e: MessageEvent) => {
    const { type, audio, model } = e.data;
    if (type === "transcribe") {
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        try {
            self.postMessage({ type: "status", status: "loading", model });

            const transcriber = await PipelineSingleton.getInstance(model, (progress: any) => {
                self.postMessage({ type: "progress", progress });
            });

            self.postMessage({ type: "status", status: "transcribing", model });

            // Per-model transcription timeout:
            // Large audio files on WASM can take several minutes
            const m = (model || "").toLowerCase();
            const timeoutMs = m.includes("small") ? 480_000   // 8 min for whisper-small
                            : m.includes("base")  ? 240_000   // 4 min for whisper-base
                            :                       180_000;  // 3 min for whisper-tiny

            const result = await Promise.race([
                transcriber(audio, {
                    chunk_length_s: 30,
                    stride_length_s: 5,
                    return_timestamps: true,
                }),
                new Promise<never>((_, reject) => {
                    timeoutHandle = setTimeout(() => {
                        reject(new Error(
                            `Transcription timed out after ${timeoutMs / 60_000} minutes. ` +
                            "Try a smaller model (Whisper Tiny or Base) or a shorter recording."
                        ));
                    }, timeoutMs);
                }),
            ]);

            if (timeoutHandle !== null) clearTimeout(timeoutHandle);

            self.postMessage({ type: "done", result });
        } catch (error: any) {
            if (timeoutHandle !== null) clearTimeout(timeoutHandle);
            self.postMessage({ type: "error", error: error.message || String(error) });
        }
    }
});
