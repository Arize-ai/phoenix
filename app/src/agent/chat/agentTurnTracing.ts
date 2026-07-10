import {
  MimeType,
  OpenInferenceSpanKind,
  SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import {
  context,
  defaultTextMapSetter,
  SpanKind,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import {
  ExportResultCode,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import {
  SimpleSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";

import { getEffectiveTraceRecordingSettings } from "@phoenix/store/agentStore";
import type {
  AgentObservabilitySettings,
  AgentServerConfig,
} from "@phoenix/store/agentStore";
import { prependBasename } from "@phoenix/utils/routingUtils";

type AgentTurnTrace = {
  span: Span;
  context: Context;
  traceId: string;
};

type AgentToolCallTraceInput = {
  toolCallId: string;
  toolName: string;
  input: unknown;
  providerMetadata?: {
    phoenix?: {
      tool_execution_environment?: string | null;
    };
  };
};

type ToolOutputTraceInput = {
  toolCallId?: string;
  state?: string;
  output?: unknown;
  errorText?: string;
};

type PxiTraceDestination = {
  ingestTraces: boolean;
  exportRemoteTraces: boolean;
};
type CreateTraceExporter = (destination: PxiTraceDestination) => SpanExporter;
type GetDestinationForSpan = (span: ReadableSpan) => PxiTraceDestination | null;

type AgentTurnTracingOptions = {
  sessionId: string;
  fetch: FetchImplementation;
  getAgentsConfig: () => AgentServerConfig;
  getObservability: () => AgentObservabilitySettings;
  forceFlushTimeoutMs?: number;
};

type TraceCarrier = {
  traceparent?: string;
  tracestate?: string;
};

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let webTracerProvider: WebTracerProvider | null = null;

const DEFAULT_FORCE_FLUSH_TIMEOUT_MS = 5_000;

const PXI_TRACER_NAME = "phoenix-ui.pxi";
const pxiTraceDestinationByTraceId = new Map<string, PxiTraceDestination>();

// PXI-specific carrier headers, sent alongside the standard W3C ones. Cloud
// deployments may inject their own client tracing (e.g. Datadog RUM) whose
// fetch instrumentation rewrites `traceparent`; the server prefers these
// headers so PXI spans always parent to the browser's `pxi.turn` root.
const PHOENIX_TRACEPARENT_HEADER = "x-phoenix-traceparent";
const PHOENIX_TRACESTATE_HEADER = "x-phoenix-tracestate";

// A module-local propagator. Deliberately not registered as the OTel global
// propagator: injection always passes the explicit turn context, and global
// registration is first-wins, so it could silently lose to (or break)
// instrumentation injected by the hosting deployment.
const pxiPropagator = new W3CTraceContextPropagator();

const createDefaultTraceExporter: CreateTraceExporter = (destination) =>
  new OTLPTraceExporter({
    url: prependBasename("/agents/traces"),
    headers: {
      "x-phoenix-pxi-ingest-traces": String(destination.ingestTraces),
      "x-phoenix-pxi-export-remote-traces": String(
        destination.exportRemoteTraces
      ),
    },
  });

function getPxiDestinationForSpan(
  span: ReadableSpan
): PxiTraceDestination | null {
  return pxiTraceDestinationByTraceId.get(span.spanContext().traceId) ?? null;
}

export class PxiRootSpanExporter implements SpanExporter {
  private exportersByDestination = new Map<string, SpanExporter>();

  constructor(
    private createTraceExporter: CreateTraceExporter = createDefaultTraceExporter,
    private getDestinationForSpan: GetDestinationForSpan = getPxiDestinationForSpan
  ) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: ExportResultCode; error?: Error }) => void
  ): void {
    const spansByDestination = new Map<
      string,
      { destination: PxiTraceDestination; spans: ReadableSpan[] }
    >();
    for (const span of spans) {
      const destination = this.getDestinationForSpan(span);
      if (!destination) {
        continue;
      }
      // PxiTraceDestination has exactly two boolean fields, so this key
      // covers all reachable destinations without relying on JSON.stringify
      // key-order stability.
      const key = `${destination.ingestTraces}:${destination.exportRemoteTraces}`;
      const group = spansByDestination.get(key) ?? { destination, spans: [] };
      group.spans.push(span);
      spansByDestination.set(key, group);
    }
    if (spansByDestination.size === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    let pendingExports = spansByDestination.size;
    let hasExportError = false;
    let exportError: Error | undefined;
    const onExportComplete = (result: {
      code: ExportResultCode;
      error?: Error;
    }) => {
      pendingExports -= 1;
      if (result.code !== ExportResultCode.SUCCESS) {
        hasExportError = true;
        exportError = result.error ?? exportError;
      }
      if (pendingExports === 0) {
        resultCallback(
          hasExportError
            ? { code: ExportResultCode.FAILED, error: exportError }
            : { code: ExportResultCode.SUCCESS }
        );
      }
    };

    for (const [key, { destination, spans }] of spansByDestination) {
      this.getExporter(key, destination).export(spans, onExportComplete);
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      Array.from(this.exportersByDestination.values()).map((exporter) =>
        exporter.shutdown()
      )
    );
    this.exportersByDestination.clear();
  }

  async forceFlush(): Promise<void> {
    await Promise.all(
      Array.from(this.exportersByDestination.values()).map((exporter) =>
        exporter.forceFlush?.()
      )
    );
  }

  private getExporter(
    key: string,
    destination: PxiTraceDestination
  ): SpanExporter {
    const existingExporter = this.exportersByDestination.get(key);
    if (existingExporter) {
      return existingExporter;
    }
    const exporter = this.createTraceExporter(destination);
    this.exportersByDestination.set(key, exporter);
    return exporter;
  }
}

function stringifyAttributeValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

// PXI tracing deliberately never touches the global OTel singletons (tracer
// provider, propagator, context manager): globals are first-registration-wins,
// so a hosting deployment that injects its own client tracing (e.g. Datadog
// RUM or another OTel distro) could silently displace ours — or be broken by
// it. Every span here is parented explicitly (see `traceToolCall` /
// `startTurn`) and trace-context injection uses the explicit turn context, so
// ambient context propagation is never needed.
function getPxiTracer(): Tracer {
  if (!webTracerProvider) {
    webTracerProvider = new WebTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(new PxiRootSpanExporter())],
    });
  }
  return webTracerProvider.getTracer(PXI_TRACER_NAME);
}

function getInputHeaders(input: RequestInfo | URL): HeadersInit | undefined {
  return input instanceof Request ? input.headers : undefined;
}

function injectTraceContextIntoRequest({
  input,
  init,
  traceContext,
}: {
  input: RequestInfo | URL;
  init: RequestInit | undefined;
  traceContext: Context;
}): RequestInit | undefined {
  const carrier: TraceCarrier = {};
  pxiPropagator.inject(traceContext, carrier, defaultTextMapSetter);
  if (!carrier.traceparent && !carrier.tracestate) {
    return init;
  }

  // The standard W3C headers keep generic proxies/collectors working; the
  // x-phoenix-* duplicates survive fetch instrumentation (RUM SDKs and the
  // like) that rewrites `traceparent`, and the server prefers them.
  const headers = new Headers(init?.headers ?? getInputHeaders(input));
  if (carrier.traceparent) {
    headers.set("traceparent", carrier.traceparent);
    headers.set(PHOENIX_TRACEPARENT_HEADER, carrier.traceparent);
  }
  if (carrier.tracestate) {
    headers.set("tracestate", carrier.tracestate);
    headers.set(PHOENIX_TRACESTATE_HEADER, carrier.tracestate);
  }
  return { ...init, headers };
}

async function forceFlushBrowserSpans(timeoutMs: number): Promise<void> {
  if (!webTracerProvider) {
    return;
  }
  if (timeoutMs <= 0) {
    return;
  }
  await Promise.race([
    // Tracing is best-effort: a failed flush must never reject, since callers
    // (e.g. turn finalization in useAgentChat) persist session state after
    // ending the turn and must not be blocked by exporter failures.
    webTracerProvider.forceFlush().catch(() => undefined),
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}

/**
 * Owns the browser-side root span for one PXI logical turn.
 *
 * The AI SDK may perform several HTTP requests while resolving one user turn
 * (initial submit, automatic tool-result sends, retries). This keeps those
 * requests in one W3C trace without globally instrumenting unrelated app fetches.
 */
export function createAgentTurnTracer({
  sessionId,
  fetch,
  getAgentsConfig,
  getObservability,
  forceFlushTimeoutMs = DEFAULT_FORCE_FLUSH_TIMEOUT_MS,
}: AgentTurnTracingOptions) {
  let activeTurnTrace: AgentTurnTrace | null = null;
  const activeToolSpansByToolCallId = new Map<string, Span>();

  function startTurn(_trigger: "submit-message" | "regenerate-message") {
    if (activeTurnTrace) {
      return;
    }
    const agentsConfig = getAgentsConfig();
    const observability = getObservability();
    const traceRecording = getEffectiveTraceRecordingSettings({
      agentsConfig,
      observability,
    });
    if (!traceRecording.ingestTraces && !traceRecording.exportRemoteTraces) {
      return;
    }

    const tracer = getPxiTracer();
    const span = tracer.startSpan("pxi.turn", {
      kind: SpanKind.CLIENT,
      attributes: {
        [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
          OpenInferenceSpanKind.AGENT,
        [SemanticConventions.SESSION_ID]: sessionId,
      },
    });
    const traceId = span.spanContext().traceId;
    pxiTraceDestinationByTraceId.set(traceId, {
      ...traceRecording,
    });
    activeTurnTrace = {
      span,
      context: trace.setSpan(context.active(), span),
      traceId,
    };
  }

  async function endTurn(error?: unknown) {
    if (!activeTurnTrace) {
      return;
    }
    const traceId = activeTurnTrace.traceId;
    if (error instanceof Error) {
      activeTurnTrace.span.recordException(error);
      activeTurnTrace.span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    } else if (typeof error === "string") {
      activeTurnTrace.span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error,
      });
    } else if (error == null) {
      // Mirror the server-side agent span, which reports OK on success;
      // leaving the status UNSET renders as "unknown" rather than "success".
      activeTurnTrace.span.setStatus({ code: SpanStatusCode.OK });
    }
    for (const span of activeToolSpansByToolCallId.values()) {
      span.end();
    }
    activeToolSpansByToolCallId.clear();
    activeTurnTrace.span.end();
    activeTurnTrace = null;
    try {
      await forceFlushBrowserSpans(forceFlushTimeoutMs);
    } finally {
      pxiTraceDestinationByTraceId.delete(traceId);
    }
  }

  function setTurnInput(input: unknown) {
    if (!activeTurnTrace || input == null) {
      return;
    }
    activeTurnTrace.span.setAttributes({
      [SemanticConventions.INPUT_VALUE]: stringifyAttributeValue(input),
      [SemanticConventions.INPUT_MIME_TYPE]: MimeType.TEXT,
    });
  }

  function setTurnOutput(output: unknown) {
    if (!activeTurnTrace || output == null) {
      return;
    }
    activeTurnTrace.span.setAttributes({
      [SemanticConventions.OUTPUT_VALUE]: stringifyAttributeValue(output),
      [SemanticConventions.OUTPUT_MIME_TYPE]: MimeType.TEXT,
    });
  }

  function recordToolOutputForActiveSpan(output: ToolOutputTraceInput) {
    if (!output.toolCallId) {
      return;
    }
    const span = activeToolSpansByToolCallId.get(output.toolCallId);
    if (!span) {
      return;
    }
    if (output.output !== undefined) {
      span.setAttributes({
        [SemanticConventions.OUTPUT_VALUE]: stringifyAttributeValue(
          output.output
        ),
        [SemanticConventions.OUTPUT_MIME_TYPE]: MimeType.JSON,
      });
    }
    if (output.errorText) {
      span.setAttributes({
        [SemanticConventions.OUTPUT_VALUE]: output.errorText,
        [SemanticConventions.OUTPUT_MIME_TYPE]: MimeType.TEXT,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: output.errorText,
      });
    }
    if (
      output.state === "output-available" ||
      output.state === "output-error" ||
      output.output !== undefined ||
      output.errorText
    ) {
      if (!output.errorText && output.state !== "output-error") {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      span.end();
      activeToolSpansByToolCallId.delete(output.toolCallId);
    }
  }

  async function traceToolCall<T>({
    toolCall,
    execute,
  }: {
    toolCall: AgentToolCallTraceInput;
    execute: (
      recordToolOutput: (output: ToolOutputTraceInput) => void
    ) => Promise<T>;
  }): Promise<T> {
    const turnTrace = activeTurnTrace;
    if (
      !turnTrace ||
      toolCall.providerMetadata?.phoenix?.tool_execution_environment ===
        "server"
    ) {
      return execute(() => undefined);
    }

    const tracer = getPxiTracer();
    const span = tracer.startSpan(
      toolCall.toolName,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
            OpenInferenceSpanKind.TOOL,
          [SemanticConventions.TOOL_NAME]: toolCall.toolName,
          [SemanticConventions.TOOL_CALL_ID]: toolCall.toolCallId,
          [SemanticConventions.INPUT_VALUE]: stringifyAttributeValue(
            toolCall.input
          ),
          [SemanticConventions.INPUT_MIME_TYPE]: MimeType.JSON,
          [SemanticConventions.SESSION_ID]: sessionId,
        },
      },
      turnTrace.context
    );

    const toolContext = trace.setSpan(turnTrace.context, span);
    const recordToolOutput = (output: ToolOutputTraceInput) => {
      recordToolOutputForActiveSpan({
        ...output,
        toolCallId: toolCall.toolCallId,
      });
    };
    activeToolSpansByToolCallId.set(toolCall.toolCallId, span);

    try {
      return await context.with(toolContext, () => execute(recordToolOutput));
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      }
      span.end();
      activeToolSpansByToolCallId.delete(toolCall.toolCallId);
      throw error;
    }
  }

  const fetchWithTurnTrace: FetchImplementation = (input, init) => {
    const turnTrace = activeTurnTrace;
    if (!turnTrace) {
      return fetch(input, init);
    }
    return context.with(turnTrace.context, () => {
      return fetch(
        input,
        injectTraceContextIntoRequest({
          input,
          init,
          traceContext: turnTrace.context,
        })
      );
    });
  };

  return {
    startTurn,
    endTurn,
    setTurnInput,
    setTurnOutput,
    recordToolOutput: recordToolOutputForActiveSpan,
    traceToolCall,
    fetch: fetchWithTurnTrace,
  };
}
