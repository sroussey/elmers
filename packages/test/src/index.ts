import { getProviderRegistry } from "ellmers-ai";
import {
  LOCAL_ONNX_TRANSFORMERJS,
  registerHuggingfaceLocalTasks,
} from "ellmers-ai-provider/hf-transformers/browser";
import {
  MEDIA_PIPE_TFJS_MODEL,
  registerMediaPipeTfJsLocalTasks,
} from "ellmers-ai-provider/tf-mediapipe/browser";
import { ConcurrencyLimiter, TaskInput, TaskOutput } from "ellmers-core";
import { InMemoryJobQueue } from "ellmers-storage/inmemory";

export * from "./sample/MediaPipeModelSamples";
export * from "./sample/ONNXModelSamples";

export async function registerHuggingfaceLocalTasksInMemory() {
  registerHuggingfaceLocalTasks();
  const ProviderRegistry = getProviderRegistry();
  const jobQueue = new InMemoryJobQueue<TaskInput, TaskOutput>(
    "local_hf",
    new ConcurrencyLimiter(1, 10),
    10
  );
  ProviderRegistry.registerQueue(LOCAL_ONNX_TRANSFORMERJS, jobQueue);
  jobQueue.start();
}

export async function registerMediaPipeTfJsLocalInMemory() {
  registerMediaPipeTfJsLocalTasks();
  const ProviderRegistry = getProviderRegistry();
  const jobQueue = new InMemoryJobQueue<TaskInput, TaskOutput>(
    "local_media_pipe",
    new ConcurrencyLimiter(1, 10),
    10
  );
  ProviderRegistry.registerQueue(MEDIA_PIPE_TFJS_MODEL, jobQueue);
  jobQueue.start();
}
