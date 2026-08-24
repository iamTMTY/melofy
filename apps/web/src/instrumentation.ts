// Next.js instrumentation hook. Runs once at server startup, before request
// handling — the right place to start OpenTelemetry so every LLM call is traced.
// Node-runtime only (OTel can't run on the Edge runtime), and a complete no-op
// unless Langfuse keys are set.
//
// We use the lightweight NodeTracerProvider (not @opentelemetry/sdk-node) on
// purpose: sdk-node pulls in the OTLP gRPC exporter (→ @grpc/grpc-js → node
// 'stream'), which Next.js's webpack can't bundle. Langfuse's span processor
// ships spans over its own HTTP transport, so the tracer provider is all we need.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { langfuseSpanProcessor } = await import('./lib/langfuse/tracing');
  if (!langfuseSpanProcessor) return; // Langfuse not configured → skip tracing

  const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node');
  const provider = new NodeTracerProvider({ spanProcessors: [langfuseSpanProcessor] });
  provider.register();
}
