export {
  trace,
  context,
  DiagLogLevel,
  type Tracer,
  SpanStatusCode,
} from "@opentelemetry/api";
export { suppressTracing } from "@opentelemetry/core";
export { registerInstrumentations } from "@opentelemetry/instrumentation";
export { type Instrumentation } from "@opentelemetry/instrumentation";
export { type NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

// OpenInference semantic conventions
export * from "@arizeai/openinference-semantic-conventions";

// OpenInference tracing helpers (withSpan, traceChain, traceAgent, traceTool,
// observe, OITracer, context setters, etc.)
export * from "@arizeai/openinference-core";

// Phoenix abstractions
export * from "./createNoOpProvider";
export * from "./register";
export * from "./utils";
