export {
  trace,
  context,
  DiagLogLevel,
  type Tracer,
  SpanStatusCode,
} from "@opentelemetry/api";
export { suppressTracing } from "@opentelemetry/core";
export { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
export { registerInstrumentations } from "@opentelemetry/instrumentation";
export { type Instrumentation } from "@opentelemetry/instrumentation";
export {
  AlwaysOffSampler,
  AlwaysOnSampler,
  type BatchSpanProcessorOptions,
  ParentBasedSampler,
  type Sampler,
  type SimpleSpanProcessorOptions,
  type SpanLimits,
  type SpanProcessor,
  TraceIdRatioBasedSampler,
  type TracerProvider as NodeTracerProvider,
} from "@opentelemetry/sdk-trace";

// OpenInference semantic conventions
export * from "@arizeai/openinference-semantic-conventions";

// OpenInference tracing helpers (withSpan, traceChain, traceAgent, traceTool,
// observe, OITracer, context setters, etc.)
export * from "@arizeai/openinference-core";

// Phoenix abstractions
export * from "./createNoOpProvider";
export * from "./lazyOpenInferenceSpanProcessor";
export * from "./register";
export * from "./spanProcessors";
export * from "./utils";
