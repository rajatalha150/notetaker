import { pipeline, env } from "@huggingface/transformers";

// Disable local models since we download from HF
env.allowLocalModels = false;
env.useBrowserCache = true;

// Configure ONNX backend to avoid external CDN requests and respect CSP
const safeEnv = env as any;
if (!safeEnv.backends) safeEnv.backends = {};
if (!safeEnv.backends.onnx) safeEnv.backends.onnx = {};
if (!safeEnv.backends.onnx.wasm) safeEnv.backends.onnx.wasm = {};

safeEnv.backends.onnx.wasm.wasmPaths = new URL("../ort-wasm/", import.meta.url).toString();
// Use multiple threads for better inference performance on larger models like TinyLlama
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

        // Prevent duplicate loads if multiple messages arrive while loading
        if (this.loading) return this.loading;

        this.loading = (async () => {
            const inst = await pipeline("text-generation", model, {
                progress_callback,
                device: "wasm",
                dtype: "q4",
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
    const { type, messages, model, maxTokens } = e.data;

    if (type === "chat") {
        try {
            self.postMessage({ type: "status", status: "loading", model });

            const generator = await PipelineSingleton.getInstance(model, (progress: any) => {
                self.postMessage({ type: "progress", progress });
            });

            self.postMessage({ type: "status", status: "generating", model });

            // TinyLlama has a 2048 context window — clamp tokens to leave room for the prompt
            const effectiveMaxTokens = Math.min(maxTokens || 1024, 1024);

            const res = await generator(messages, {
                max_new_tokens: effectiveMaxTokens,
                do_sample: false,
                return_full_text: false,
            });

            let outputText = res[0].generated_text;
            if (Array.isArray(outputText)) {
                outputText = outputText[outputText.length - 1].content || "";
            } else if (typeof outputText === "string") {
                outputText = outputText.trim();
            }

            self.postMessage({ type: "done", result: outputText });
        } catch (error: any) {
            self.postMessage({ type: "error", error: error.message || String(error) });
        }
    } else if (type === "preload") {
        // Allow the UI to pre-download the model in the background
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
