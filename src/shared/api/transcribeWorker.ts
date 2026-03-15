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
safeEnv.backends.onnx.wasm.numThreads = 1;

class PipelineSingleton {
    static instance: any = null;

    static async getInstance(model: string, progress_callback?: (o: any) => void) {
        if (this.instance === null) {
            this.instance = await pipeline("automatic-speech-recognition", model, {
                progress_callback,
                device: "wasm",
                dtype: "q8",
            });
        }
        return this.instance;
    }
}

self.addEventListener("message", async (e: MessageEvent) => {
    const { type, audio, model } = e.data;
    if (type === "transcribe") {
        try {
            const transcriber = await PipelineSingleton.getInstance(model, (progress: any) => {
                self.postMessage({ type: "progress", progress });
            });

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
