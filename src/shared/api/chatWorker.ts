import { pipeline, env } from "@huggingface/transformers";

// Disable local models since we download from HF
env.allowLocalModels = false;
env.useBrowserCache = true;

// Configure ONNX backend to avoid external CDN requests and respect CSP
const safeEnv = env as any;
if (!safeEnv.backends) safeEnv.backends = {};
if (!safeEnv.backends.onnx) safeEnv.backends.onnx = {};
if (!safeEnv.backends.onnx.wasm) safeEnv.backends.onnx.wasm = {};

safeEnv.backends.onnx.wasm.wasmPaths = "/ort-wasm/";
safeEnv.backends.onnx.wasm.numThreads = 1;

class PipelineSingleton {
    static instance: any = null;

    static async getInstance(model: string, progress_callback?: (o: any) => void) {
        if (this.instance === null) {
            this.instance = await pipeline("text-generation", model, {
                progress_callback,
                device: "wasm",
                dtype: "q4",
            });
        }
        return this.instance;
    }
}

self.addEventListener("message", async (e: MessageEvent) => {
    const { type, messages, model, maxTokens } = e.data;
    if (type === "chat") {
        try {
            const generator = await PipelineSingleton.getInstance(model, (progress: any) => {
                self.postMessage({ type: "progress", progress });
            });

            // Transformers.js handles conversational arrays automatically natively formatting with chat templates
            const res = await generator(messages, {
                max_new_tokens: maxTokens,
                do_sample: false,
                return_full_text: false,
            });

            self.postMessage({ type: "done", result: res[0].generated_text });
        } catch (error: any) {
            self.postMessage({ type: "error", error: error.message || String(error) });
        }
    }
});
