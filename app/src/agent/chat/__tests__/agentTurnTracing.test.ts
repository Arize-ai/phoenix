import { SpanStatusCode } from "@opentelemetry/api";
import { ExportResultCode } from "@opentelemetry/core";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAgentTurnTracer,
  PxiRootSpanExporter,
} from "@phoenix/agent/chat/agentTurnTracing";
import type {
  AgentObservabilitySettings,
  AgentServerConfig,
} from "@phoenix/store/agentStore";

const agentsConfig: AgentServerConfig = {
  collectorEndpoint: null,
  assistantProjectName: "assistant_agent",
  webAccessEnabled: false,
  assistantEnabled: true,
  allowLocalTraces: true,
  allowRemoteExport: false,
};

const observability: AgentObservabilitySettings = {
  storeLocalTraces: true,
  exportRemoteTraces: false,
  attachUserId: false,
  acknowledgedTraceConsent: {
    allowLocalTraces: true,
    allowRemoteExport: false,
  },
};

function getTraceId(traceparent: string): string {
  return traceparent.split("-")[1] ?? "";
}

function readTraceparent(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get("traceparent");
}

function createMockFetch() {
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null)
  );
}

function createReadableSpan({
  name,
  traceId,
  attributes = {},
}: {
  name: string;
  traceId: string;
  attributes?: ReadableSpan["attributes"];
}): ReadableSpan {
  return {
    name,
    attributes,
    spanContext: () => ({
      traceId,
      spanId: `${traceId.slice(0, 15)}0`,
      traceFlags: 1,
    }),
  } as unknown as ReadableSpan;
}

describe("createAgentTurnTracer", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not inject trace context when PXI trace recording is disabled", async () => {
    const fetch = createMockFetch();
    const tracer = createAgentTurnTracer({
      sessionId: "session-1",
      fetch,
      getAgentsConfig: () => ({ ...agentsConfig, allowLocalTraces: false }),
      getObservability: () => observability,
      forceFlushTimeoutMs: 0,
    });

    tracer.startTurn("submit-message");
    await tracer.fetch("/agents/assistant/sessions/session-1/chat", {
      method: "POST",
    });

    expect(readTraceparent(fetch.mock.calls[0]?.[1])).toBeNull();
  });

  it("injects the same trace context across requests in one active turn", async () => {
    const fetch = createMockFetch();
    const tracer = createAgentTurnTracer({
      sessionId: "session-1",
      fetch,
      getAgentsConfig: () => agentsConfig,
      getObservability: () => observability,
      forceFlushTimeoutMs: 0,
    });

    tracer.startTurn("submit-message");
    await tracer.fetch("/agents/assistant/sessions/session-1/chat", {
      method: "POST",
    });
    tracer.startTurn("submit-message");
    await tracer.fetch("/agents/assistant/sessions/session-1/chat", {
      method: "POST",
    });

    const firstTraceparent = readTraceparent(fetch.mock.calls[0]?.[1]);
    const secondTraceparent = readTraceparent(fetch.mock.calls[1]?.[1]);
    expect(firstTraceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
    expect(secondTraceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
    expect(getTraceId(secondTraceparent ?? "")).toEqual(
      getTraceId(firstTraceparent ?? "")
    );
  });

  it("starts a new trace after the previous turn ends", async () => {
    const fetch = createMockFetch();
    const tracer = createAgentTurnTracer({
      sessionId: "session-1",
      fetch,
      getAgentsConfig: () => agentsConfig,
      getObservability: () => observability,
      forceFlushTimeoutMs: 0,
    });

    tracer.startTurn("submit-message");
    await tracer.fetch("/agents/assistant/sessions/session-1/chat");
    await tracer.endTurn();
    tracer.startTurn("submit-message");
    await tracer.fetch("/agents/assistant/sessions/session-1/chat");

    const firstTraceparent = readTraceparent(fetch.mock.calls[0]?.[1]);
    const secondTraceparent = readTraceparent(fetch.mock.calls[1]?.[1]);
    expect(getTraceId(secondTraceparent ?? "")).not.toEqual(
      getTraceId(firstTraceparent ?? "")
    );
  });

  it("resolves endTurn even when the span flush rejects", async () => {
    const forceFlushSpy = vi
      .spyOn(WebTracerProvider.prototype, "forceFlush")
      .mockRejectedValue(new Error("exporter unavailable"));
    const tracer = createAgentTurnTracer({
      sessionId: "session-1",
      fetch: createMockFetch(),
      getAgentsConfig: () => agentsConfig,
      getObservability: () => observability,
    });

    tracer.startTurn("submit-message");

    // A rejected flush must not propagate: turn finalization in useAgentChat
    // persists session state after endTurn and must never be blocked.
    await expect(tracer.endTurn()).resolves.toBeUndefined();
    expect(forceFlushSpy).toHaveBeenCalled();
  });

  it("sets an OK status on the turn span when the turn ends without error", async () => {
    const exportedSpans: ReadableSpan[] = [];
    vi.spyOn(PxiRootSpanExporter.prototype, "export").mockImplementation(
      (spans, resultCallback) => {
        exportedSpans.push(...spans);
        resultCallback({ code: ExportResultCode.SUCCESS });
      }
    );
    const tracer = createAgentTurnTracer({
      sessionId: "session-1",
      fetch: createMockFetch(),
      getAgentsConfig: () => agentsConfig,
      getObservability: () => observability,
      forceFlushTimeoutMs: 0,
    });

    tracer.startTurn("submit-message");
    await tracer.endTurn();
    tracer.startTurn("submit-message");
    await tracer.endTurn("user interrupted");

    const [successTurnSpan, errorTurnSpan] = exportedSpans.filter(
      (span) => span.name === "pxi.turn"
    );
    expect(successTurnSpan?.status.code).toBe(SpanStatusCode.OK);
    expect(errorTurnSpan?.status).toEqual({
      code: SpanStatusCode.ERROR,
      message: "user interrupted",
    });
  });

  it("parents client tool spans directly under the pxi.turn root", async () => {
    const exportedSpans: ReadableSpan[] = [];
    vi.spyOn(PxiRootSpanExporter.prototype, "export").mockImplementation(
      (spans, resultCallback) => {
        exportedSpans.push(...spans);
        resultCallback({ code: ExportResultCode.SUCCESS });
      }
    );
    const tracer = createAgentTurnTracer({
      sessionId: "session-1",
      fetch: createMockFetch(),
      getAgentsConfig: () => agentsConfig,
      getObservability: () => observability,
      forceFlushTimeoutMs: 0,
    });

    tracer.startTurn("submit-message");
    await tracer.fetch("/agents/assistant/sessions/session-1/chat", {
      method: "POST",
    });
    await tracer.traceToolCall({
      toolCall: {
        toolCallId: "tool-1",
        toolName: "bash",
        input: { cmd: "ls" },
      },
      execute: async (recordToolOutput) => {
        recordToolOutput({
          toolCallId: "tool-1",
          state: "output-available",
          output: "ok",
        });
      },
    });
    await tracer.fetch("/agents/assistant/sessions/session-1/chat", {
      method: "POST",
    });
    await tracer.traceToolCall({
      toolCall: { toolCallId: "tool-2", toolName: "navigate", input: {} },
      execute: async (recordToolOutput) => {
        recordToolOutput({
          toolCallId: "tool-2",
          state: "output-available",
          output: "done",
        });
      },
    });
    await tracer.endTurn();

    const turnSpan = exportedSpans.find((span) => span.name === "pxi.turn");
    const firstToolSpan = exportedSpans.find((span) => span.name === "bash");
    const secondToolSpan = exportedSpans.find(
      (span) => span.name === "navigate"
    );

    expect(turnSpan).toBeDefined();
    // The turn is a flat trace: no intermediate grouping spans are created.
    expect(exportedSpans).toHaveLength(3);
    expect(firstToolSpan?.parentSpanContext?.spanId).toBe(
      turnSpan?.spanContext().spanId
    );
    expect(secondToolSpan?.parentSpanContext?.spanId).toBe(
      turnSpan?.spanContext().spanId
    );
    expect(firstToolSpan?.status.code).toBe(SpanStatusCode.OK);
    expect(secondToolSpan?.status.code).toBe(SpanStatusCode.OK);
  });

  it("exports only PXI browser spans with registered projects by project", async () => {
    const exportedSpansByProjectName = new Map<string, ReadableSpan[]>();
    const projectNameByTraceId = new Map([
      ["trace-local", "assistant_agent"],
      ["trace-other", "other_agent"],
    ]);
    const createExporter = vi.fn((projectName: string): SpanExporter => {
      return {
        export(spans, resultCallback) {
          exportedSpansByProjectName.set(projectName, spans);
          resultCallback({ code: ExportResultCode.SUCCESS });
        },
        shutdown: async () => undefined,
      };
    });
    const exporter = new PxiRootSpanExporter(
      createExporter,
      (span) => projectNameByTraceId.get(span.spanContext().traceId) ?? null
    );
    const resultCallback = vi.fn();

    const localRootSpan = createReadableSpan({
      name: "pxi.turn",
      traceId: "trace-local",
    });
    const unregisteredRootSpan = createReadableSpan({
      name: "pxi.turn",
      traceId: "trace-unregistered",
    });
    const localToolSpan = createReadableSpan({
      name: "bash",
      traceId: "trace-local",
      attributes: {
        "openinference.span.kind": "TOOL",
      },
    });
    const otherProjectSpan = createReadableSpan({
      name: "pxi.turn",
      traceId: "trace-other",
    });
    const unrelatedSpan = createReadableSpan({
      name: "click",
      traceId: "trace-unrelated",
    });

    exporter.export(
      [
        localRootSpan,
        unregisteredRootSpan,
        localToolSpan,
        otherProjectSpan,
        unrelatedSpan,
      ],
      resultCallback
    );

    expect(createExporter).toHaveBeenCalledTimes(2);
    expect(createExporter).toHaveBeenCalledWith("assistant_agent");
    expect(createExporter).toHaveBeenCalledWith("other_agent");
    expect(exportedSpansByProjectName.get("assistant_agent")).toEqual([
      localRootSpan,
      localToolSpan,
    ]);
    expect(exportedSpansByProjectName.get("other_agent")).toEqual([
      otherProjectSpan,
    ]);
    expect(resultCallback).toHaveBeenCalledWith({
      code: ExportResultCode.SUCCESS,
    });
  });

  it("reports failed project exports even without an exporter error object", () => {
    const exporter = new PxiRootSpanExporter(
      () => ({
        export(_spans, resultCallback) {
          resultCallback({ code: ExportResultCode.FAILED });
        },
        shutdown: async () => undefined,
      }),
      () => "assistant_agent"
    );
    const resultCallback = vi.fn();

    exporter.export(
      [createReadableSpan({ name: "pxi.turn", traceId: "trace-local" })],
      resultCallback
    );

    expect(resultCallback).toHaveBeenCalledWith({
      code: ExportResultCode.FAILED,
      error: undefined,
    });
  });
});
