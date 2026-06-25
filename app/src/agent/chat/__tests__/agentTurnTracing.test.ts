import { ExportResultCode } from "@opentelemetry/core";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
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

describe("createAgentTurnTracer", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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

  it("exports only locally ingested PXI browser spans by project", async () => {
    const exportedSpansByProjectName = new Map<string, ReadableSpan[]>();
    const createExporter = vi.fn((projectName: string): SpanExporter => {
      return {
        export(spans, resultCallback) {
          exportedSpansByProjectName.set(projectName, spans);
          resultCallback({ code: ExportResultCode.SUCCESS });
        },
        shutdown: async () => undefined,
      };
    });
    const exporter = new PxiRootSpanExporter(createExporter);
    const resultCallback = vi.fn();

    const localRootSpan = {
      name: "pxi.turn",
      attributes: {
        "phoenix.agent.ingest_traces": true,
        "phoenix.agent.project_name": "assistant_agent",
      },
    } as unknown as ReadableSpan;
    const remoteOnlyRootSpan = {
      name: "pxi.turn",
      attributes: {
        "phoenix.agent.ingest_traces": false,
        "phoenix.agent.project_name": "remote_agent",
      },
    } as unknown as ReadableSpan;
    const localToolSpan = {
      name: "bash",
      attributes: {
        "phoenix.agent.ingest_traces": true,
        "phoenix.agent.project_name": "assistant_agent",
        "openinference.span.kind": "TOOL",
      },
    } as unknown as ReadableSpan;
    const unrelatedSpan = {
      name: "click",
      attributes: {},
    } as unknown as ReadableSpan;

    exporter.export(
      [localRootSpan, remoteOnlyRootSpan, localToolSpan, unrelatedSpan],
      resultCallback
    );

    expect(createExporter).toHaveBeenCalledOnce();
    expect(createExporter).toHaveBeenCalledWith("assistant_agent");
    expect(exportedSpansByProjectName.get("assistant_agent")).toEqual([
      localRootSpan,
      localToolSpan,
    ]);
    expect(resultCallback).toHaveBeenCalledWith({
      code: ExportResultCode.SUCCESS,
    });
  });

  it("keeps one trace when automatic follow-up should continue", async () => {
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
    await tracer.resolveAutomaticSend(true);
    tracer.startTurn("submit-message");
    await tracer.fetch("/agents/assistant/sessions/session-1/chat");

    const firstTraceparent = readTraceparent(fetch.mock.calls[0]?.[1]);
    const secondTraceparent = readTraceparent(fetch.mock.calls[1]?.[1]);
    expect(getTraceId(secondTraceparent ?? "")).toEqual(
      getTraceId(firstTraceparent ?? "")
    );
  });

  it("ends the turn when automatic follow-up should not continue", async () => {
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
    await tracer.resolveAutomaticSend(false);
    tracer.startTurn("submit-message");
    await tracer.fetch("/agents/assistant/sessions/session-1/chat");

    const firstTraceparent = readTraceparent(fetch.mock.calls[0]?.[1]);
    const secondTraceparent = readTraceparent(fetch.mock.calls[1]?.[1]);
    expect(getTraceId(secondTraceparent ?? "")).not.toEqual(
      getTraceId(firstTraceparent ?? "")
    );
  });
});
