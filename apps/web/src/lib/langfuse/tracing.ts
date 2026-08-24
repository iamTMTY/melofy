import 'server-only';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { config } from '@/lib/config';

// Single shared OTel span processor for Langfuse LLM tracing. It's created ONCE
// here (a module singleton) and imported by both instrumentation.ts (which
// registers it with the Node OTel SDK) and the code that flushes it.
//
// No-op when Langfuse isn't configured: with no keys we never construct the
// processor, so nothing is created or sent — tracing stays entirely optional,
// consistent with the rest of the app.

export const langfuseTracingEnabled = !!(config.langfusePublicKey && config.langfuseSecretKey);

export const langfuseSpanProcessor = langfuseTracingEnabled
  ? new LangfuseSpanProcessor({
      publicKey: config.langfusePublicKey,
      secretKey: config.langfuseSecretKey,
      baseUrl: config.langfuseBaseUrl,
    })
  : null;

/**
 * Force-flush queued spans. In a long-running server the processor batches and
 * flushes on its own, but we call this at the end of a translation so traces
 * appear promptly (and survive if the process is short-lived). Best-effort.
 */
export async function flushTracing(): Promise<void> {
  try {
    await langfuseSpanProcessor?.forceFlush();
  } catch {
    /* tracing must never break a request */
  }
}
