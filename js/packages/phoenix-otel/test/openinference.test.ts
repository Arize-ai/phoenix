import type { SpanProcessor } from "@opentelemetry/sdk-trace-node";
import { afterEach, describe, expect, test } from "vitest";

import {
  attachGlobalTracerProvider,
  detachGlobalTracerProvider,
  observe,
  register,
  trace,
  traceTool,
  withSpan,
} from "../src";

afterEach(() => {
  detachGlobalTracerProvider();
});

function createCountingSpanProcessor() {
  let startCount = 0;

  const processor: SpanProcessor = {
    onStart: () => {
      startCount += 1;
    },
    onEnd: () => {},
    forceFlush: async () => {},
    shutdown: async () => {},
  };

  return {
    processor,
    getStartCount: () => startCount,
  };
}

async function runInsideParentSpan<T>(name: string, fn: () => Promise<T>) {
  return trace.getTracer("test-parent").startActiveSpan(name, async (span) => {
    try {
      return {
        parentTraceId: span.spanContext().traceId,
        childResult: await fn(),
      };
    } finally {
      span.end();
    }
  });
}

describe("openinference re-exports", () => {
  test("withSpan resolves the current global tracer when invoked", async () => {
    const { processor, getStartCount } = createCountingSpanProcessor();
    const provider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [processor],
      global: false,
    });
    const traced = withSpan(async () => {
      return trace.getActiveSpan()?.spanContext().traceId;
    });
    const registration = attachGlobalTracerProvider(provider);

    try {
      const result = await runInsideParentSpan("parent", async () => traced());

      expect(result.childResult).toBe(result.parentTraceId);
      expect(getStartCount()).toBe(2);
    } finally {
      registration.detach();
      await provider.shutdown();
    }
  });

  test("traceTool follows global tracer provider swaps", async () => {
    const firstCounter = createCountingSpanProcessor();
    const secondCounter = createCountingSpanProcessor();
    const firstProvider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [firstCounter.processor],
      global: false,
    });
    const secondProvider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [secondCounter.processor],
      global: false,
    });
    const tracedTool = traceTool(async () => {
      return trace.getActiveSpan()?.spanContext().traceId;
    });

    try {
      const firstRegistration = attachGlobalTracerProvider(firstProvider);
      try {
        const firstResult = await runInsideParentSpan(
          "first-parent",
          async () => tracedTool()
        );

        expect(firstResult.childResult).toBe(firstResult.parentTraceId);
        expect(firstCounter.getStartCount()).toBe(2);
        expect(secondCounter.getStartCount()).toBe(0);
      } finally {
        firstRegistration.detach();
      }

      const secondRegistration = attachGlobalTracerProvider(secondProvider);
      try {
        const secondResult = await runInsideParentSpan(
          "second-parent",
          async () => tracedTool()
        );

        expect(secondResult.childResult).toBe(secondResult.parentTraceId);
        expect(firstCounter.getStartCount()).toBe(2);
        expect(secondCounter.getStartCount()).toBe(2);
      } finally {
        secondRegistration.detach();
      }
    } finally {
      await firstProvider.shutdown();
      await secondProvider.shutdown();
    }
  });

  test("observe keeps class methods on the active global tracer", async () => {
    const { processor, getStartCount } = createCountingSpanProcessor();
    const provider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [processor],
      global: false,
    });
    const decorateMethod = observe();
    const observedMethod = decorateMethod(
      function (this: { prefix: string }) {
        return `${this.prefix}:${trace.getActiveSpan()?.spanContext().traceId}`;
      },
      {
        name: "run",
      } as ClassMethodDecoratorContext
    ) as (this: { prefix: string }) => string;
    const agent = {
      prefix: "agent",
      run: observedMethod,
    };
    const registration = attachGlobalTracerProvider(provider);

    try {
      const result = await runInsideParentSpan("observed-parent", async () =>
        Promise.resolve(agent.run())
      );

      expect(result.childResult).toBe(`agent:${result.parentTraceId}`);
      expect(getStartCount()).toBe(2);
    } finally {
      registration.detach();
      await provider.shutdown();
    }
  });
});
