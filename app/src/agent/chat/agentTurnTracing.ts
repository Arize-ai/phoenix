import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
} from "@opentelemetry/api";
import { ZoneContextManager } from "@opentelemetry/context-zone";
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
  projectName: string;
  ingestTraces: boolean;
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
  state?: string;
  output?: unknown;
  errorText?: string;
};

type PxiRootSpanAttributes = {
  "phoenix.agent.ingest_traces": boolean;
  "phoenix.agent.project_name": string;
};

type CreateLocalTraceExporter = (projectName: string) => SpanExporter;

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

function getPxiLocalSpanAttributes(
  span: ReadableSpan
): PxiRootSpanAttributes | null {
  const ingestTraces = span.attributes["phoenix.agent.ingest_traces"];
  const projectName = span.attributes["phoenix.agent.project_name"];
  if (typeof ingestTraces !== "boolean" || typeof projectName !== "string") {
    return null;
  }
  return {
    "phoenix.agent.ingest_traces": ingestTraces,
    "phoenix.agent.project_name": projectName,
  };
}

export class PxiRootSpanExporter implements SpanExporter {
  private exportersByProjectName = new Map<string, SpanExporter>();

  constructor(
    private createLocalTraceExporter: CreateLocalTraceExporter = (
      projectName
    ) =>
      new OTLPTraceExporter({
        url: prependBasename("/v1/traces"),
        headers: {
          "x-project-name": projectName,
        },
      })
  ) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: ExportResultCode; error?: Error }) => void
  ): void {
    const spansByProjectName = new Map<string, ReadableSpan[]>();
    for (const span of spans) {
      const attributes = getPxiLocalSpanAttributes(span);
      if (!attributes?.["phoenix.agent.ingest_traces"]) {
        continue;
      }
      const projectName = attributes["phoenix.agent.project_name"];
      const projectSpans = spansByProjectName.get(projectName) ?? [];
      projectSpans.push(span);
      spansByProjectName.set(projectName, projectSpans);
    }
    if (spansByProjectName.size === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    let pendingExports = spansByProjectName.size;
    let exportError: Error | undefined;
    const onExportComplete = (result: {
      code: ExportResultCode;
      error?: Error;
    }) => {
      pendingExports -= 1;
      if (result.code !== ExportResultCode.SUCCESS) {
        exportError = result.error ?? exportError;
      }
      if (pendingExports === 0) {
        resultCallback(
          exportError
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
  provider.register({
    contextManager: new ZoneContextManager(),
  });
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
    webTracerProvider.forceFlush(),
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

  function startTurn(trigger: "submit-message" | "regenerate-message") {
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

    ensureWebTracerProviderRegistered();
    const tracer = trace.getTracer("phoenix-ui.pxi");
    const span = tracer.startSpan("pxi.turn", {
      kind: SpanKind.CLIENT,
      attributes: {
        "openinference.span.kind": "AGENT",
        "phoenix.agent.session_id": sessionId,
        "phoenix.agent.trigger": trigger,
        "phoenix.agent.project_name": agentsConfig.assistantProjectName,
        "phoenix.agent.ingest_traces": traceRecording.ingestTraces,
      },
    });
    activeTurnTrace = {
      span,
      context: trace.setSpan(context.active(), span),
      projectName: agentsConfig.assistantProjectName,
      ingestTraces: traceRecording.ingestTraces,
    };
  }

  async function endTurn(error?: unknown) {
    if (!activeTurnTrace) {
      return;
    }
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
    }
    activeTurnTrace.span.end();
    activeTurnTrace = null;
    await forceFlushBrowserSpans(forceFlushTimeoutMs);
  }

  function setTurnInput(input: unknown) {
    if (!activeTurnTrace || input == null) {
      return;
    }
    activeTurnTrace.span.setAttributes({
      "input.value": stringifyAttributeValue(input),
      "input.mime_type": "text/plain",
    });
  }

  function setTurnOutput(output: unknown) {
    if (!activeTurnTrace || output == null) {
      return;
    }
    activeTurnTrace.span.setAttributes({
      "output.value": stringifyAttributeValue(output),
      "output.mime_type": "text/plain",
    });
  }

  async function resolveAutomaticSend(shouldSendAutomatically: boolean) {
    if (!shouldSendAutomatically) {
      await endTurn();
    }
    return shouldSendAutomatically;
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

    const tracer = trace.getTracer("phoenix-ui.pxi");
    const span = tracer.startSpan(
      toolCall.toolName,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          "openinference.span.kind": "TOOL",
          "tool.name": toolCall.toolName,
          "tool_call.id": toolCall.toolCallId,
          "input.value": stringifyAttributeValue(toolCall.input),
          "input.mime_type": "application/json",
          "phoenix.agent.session_id": sessionId,
          "phoenix.agent.project_name": turnTrace.projectName,
          "phoenix.agent.ingest_traces": turnTrace.ingestTraces,
        },
      },
      turnTrace.context
    );

    const toolContext = trace.setSpan(turnTrace.context, span);
    const recordToolOutput = (output: ToolOutputTraceInput) => {
      if (output.output !== undefined) {
        span.setAttributes({
          "output.value": stringifyAttributeValue(output.output),
          "output.mime_type": "application/json",
        });
      }
      if (output.errorText) {
        span.setAttributes({
          "output.value": output.errorText,
          "output.mime_type": "text/plain",
        });
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: output.errorText,
        });
      }
    };

    try {
      return await context.with(toolContext, () => execute(recordToolOutput));
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      }
      throw error;
    } finally {
      span.end();
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
    resolveAutomaticSend,
    traceToolCall,
    fetch: fetchWithTurnTrace,
  };
}
