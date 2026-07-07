import {
  MimeType,
  OpenInferenceSpanKind,
  SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
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

type CreateLocalTraceExporter = (projectName: string) => SpanExporter;
type GetProjectNameForSpan = (span: ReadableSpan) => string | null;

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

let isProviderRegistered = false;
let webTracerProvider: WebTracerProvider | null = null;

const DEFAULT_FORCE_FLUSH_TIMEOUT_MS = 5_000;

const PXI_TRACER_NAME = "phoenix-ui.pxi";
const pxiProjectNameByTraceId = new Map<string, string>();

const createDefaultLocalTraceExporter: CreateLocalTraceExporter = (
  projectName
) =>
  new OTLPTraceExporter({
    url: prependBasename("/v1/traces"),
    headers: {
      "x-project-name": projectName,
    },
  });

function getPxiProjectNameForSpan(span: ReadableSpan): string | null {
  return pxiProjectNameByTraceId.get(span.spanContext().traceId) ?? null;
}

export class PxiRootSpanExporter implements SpanExporter {
  private exportersByProjectName = new Map<string, SpanExporter>();

  constructor(
    private createLocalTraceExporter: CreateLocalTraceExporter = createDefaultLocalTraceExporter,
    private getProjectNameForSpan: GetProjectNameForSpan = getPxiProjectNameForSpan
  ) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: ExportResultCode; error?: Error }) => void
  ): void {
    const spansByProjectName = new Map<string, ReadableSpan[]>();
    for (const span of spans) {
      const projectName = this.getProjectNameForSpan(span);
      if (!projectName) {
        continue;
      }
      const projectSpans = spansByProjectName.get(projectName) ?? [];
      projectSpans.push(span);
      spansByProjectName.set(projectName, projectSpans);
    }
    if (spansByProjectName.size === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    let pendingExports = spansByProjectName.size;
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

    for (const [projectName, projectSpans] of spansByProjectName) {
      this.getExporter(projectName).export(projectSpans, onExportComplete);
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      Array.from(this.exportersByProjectName.values()).map((exporter) =>
        exporter.shutdown()
      )
    );
    this.exportersByProjectName.clear();
  }

  async forceFlush(): Promise<void> {
    await Promise.all(
      Array.from(this.exportersByProjectName.values()).map((exporter) =>
        exporter.forceFlush?.()
      )
    );
  }

  private getExporter(projectName: string): SpanExporter {
    const existingExporter = this.exportersByProjectName.get(projectName);
    if (existingExporter) {
      return existingExporter;
    }
    const exporter = this.createLocalTraceExporter(projectName);
    this.exportersByProjectName.set(projectName, exporter);
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

function ensureWebTracerProviderRegistered() {
  if (isProviderRegistered) {
    return;
  }
  const provider = new WebTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(new PxiRootSpanExporter())],
  });
  // The default StackContextManager is sufficient: every span created here is
  // parented explicitly (see `traceToolCall` / `startTurn`) and trace-context
  // injection uses the explicit turn context, so ambient context does not need
  // to survive across awaits. This deliberately avoids ZoneContextManager,
  // whose Zone.js dependency monkey-patches every async primitive app-wide.
  //
  // This module owns the global OTel registration (tracer provider and
  // propagator) for the Phoenix UI; any future browser instrumentation should
  // reuse this provider rather than registering its own.
  provider.register();
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  webTracerProvider = provider;
  isProviderRegistered = true;
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
  propagation.inject(traceContext, carrier);
  if (!carrier.traceparent && !carrier.tracestate) {
    return init;
  }

  const headers = new Headers(init?.headers ?? getInputHeaders(input));
  if (carrier.traceparent) {
    headers.set("traceparent", carrier.traceparent);
  }
  if (carrier.tracestate) {
    headers.set("tracestate", carrier.tracestate);
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
    if (!traceRecording.ingestTraces) {
      return;
    }

    ensureWebTracerProviderRegistered();
    const tracer = trace.getTracer(PXI_TRACER_NAME);
    const span = tracer.startSpan("pxi.turn", {
      kind: SpanKind.CLIENT,
      attributes: {
        [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
          OpenInferenceSpanKind.AGENT,
        [SemanticConventions.SESSION_ID]: sessionId,
      },
    });
    const traceId = span.spanContext().traceId;
    pxiProjectNameByTraceId.set(traceId, agentsConfig.assistantProjectName);
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
      pxiProjectNameByTraceId.delete(traceId);
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

    const tracer = trace.getTracer(PXI_TRACER_NAME);
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
