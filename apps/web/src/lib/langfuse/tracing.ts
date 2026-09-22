import 'server-only';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { config } from '@/lib/config';

export const langfuseTracingEnabled = !!(config.langfusePublicKey && config.langfuseSecretKey);

export const langfuseSpanProcessor = langfuseTracingEnabled
  ? new LangfuseSpanProcessor({
      publicKey: config.langfusePublicKey,
      secretKey: config.langfuseSecretKey,
      baseUrl: config.langfuseBaseUrl,
    })
  : null;

export async function flushTracing(): Promise<void> {
  try {
    await langfuseSpanProcessor?.forceFlush();
  } catch {}
}
