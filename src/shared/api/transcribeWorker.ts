import { pipeline, env } from "@huggingface/transformers";

// Disable local models since we download from HF
env.allowLocalModels = false;
env.useBrowserCache = true;

// Configure ONNX backend to avoid external CDN requests
const safeEnv = env as any;
if (!safeEnv.backends) safeEnv.backends = {};
if (!safeEnv.backends.onnx) safeEnv.backends.onnx = {};
if (!safeEnv.backends.onnx.wasm) safeEnv.backends.onnx.wasm = {};

safeEnv.backends.onnx.wasm.wasmPaths = new URL("../ort-wasm/", import.meta.url).toString();
const maxThreads = typeof navigator !== "undefined" && navigator.hardwareConcurrency
    ? Math.min(navigator.hardwareConcurrency, 4)
    : 2;
safeEnv.backends.onnx.wasm.numThreads = maxThreads;

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
            const inst = await pipeline("automatic-speech-recognition", model, {
                progress_callback,
                device: "wasm",
                dtype: "q8",
            });
            this.instance = inst;
            this.currentModel = model;
            this.loading = null;
            return inst;
        })();

        return this.loading;
    }
}

self.addEventListener("message", async (e: MessageEvent) => {
    const { type, audio, model } = e.data;
    if (type === "transcribe") {
        try {
            self.postMessage({ type: "status", status: "loading", model });

            const transcriber = await PipelineSingleton.getInstance(model, (progress: any) => {
                self.postMessage({ type: "progress", progress });
            });

            self.postMessage({ type: "status", status: "transcribing", model });

            const res = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
            });

            self.postMessage({ type: "done", result: res });
        } catch (error: any) {
            self.postMessage({ type: "error", error: error.message || String(error) });
        }
    }
});
