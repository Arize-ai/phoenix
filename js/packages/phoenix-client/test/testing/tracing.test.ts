import {
  attachGlobalTracerProvider,
  register,
  SemanticConventions,
  SpanStatusCode,
  trace,
  type GlobalTracerProviderRegistration,
  type NodeTracerProvider,
} from "@arizeai/phoenix-otel";
import type { SpanProcessor } from "@opentelemetry/sdk-trace-node";
import { describe, expect, it } from "vitest";

import { recordOutput, traceEvaluator } from "../../src/testing/helpers";
import {
  runTaskWithTracing,
  teardownSuite,
} from "../../src/testing/phoenix-test-tracking";
import {
  runStorage,
  type RunState,
  type SuiteState,
} from "../../src/testing/state";

type EndedSpan = Parameters<SpanProcessor["onEnd"]>[0];

describe("Phoenix test tracing", () => {
  it("ends the task span at recordOutput and starts evaluators as separate traces", async () => {
    const harness = createTracingHarness();
    const run = createRunState(harness.suite);
    let eventsAtLogOutput: string[] = [];

    try {
      await runStorage.run(run, async () => {
        const outcome = await runTaskWithTracing(
          harness.suite,
          "answers question",
          async () => {
            await trace
              .getTracer("instrumented-task")
              .startActiveSpan("task child", async (span) => {
                span.end();
              });

            recordOutput({ answer: "hello" });
            eventsAtLogOutput = [...harness.events];

            const evaluator = traceEvaluator(
              async ({ output }: { output: string }) => {
                await trace
                  .getTracer("instrumented-evaluator")
                  .startActiveSpan("eval child", async (span) => {
                    span.end();
                  });
                return { name: "quality", score: output === "hello" };
              },
              { name: "quality" }
            );

            await evaluator({ output: "hello" });
          }
        );

        expect("error" in outcome).toBe(false);
      });

      expect(eventsAtLogOutput).toEqual([
        "start:Test: answers question",
        "start:task child",
        "end:task child",
        "end:Test: answers question",
      ]);

      const taskSpan = findEndedSpan(
        harness.endedSpans,
        "Test: answers question"
      );
      const taskChildSpan = findEndedSpan(harness.endedSpans, "task child");
      const evaluatorSpan = findEndedSpan(
        harness.endedSpans,
        "Evaluation: quality"
      );
      const evaluatorChildSpan = findEndedSpan(
        harness.endedSpans,
        "eval child"
      );

      expect(taskSpan.status.code).toBe(SpanStatusCode.OK);
      expect(taskSpan.attributes[SemanticConventions.OUTPUT_VALUE]).toBe(
        JSON.stringify({ answer: "hello" })
      );
      expect(taskChildSpan.spanContext().traceId).toBe(
        taskSpan.spanContext().traceId
      );
      expect(taskChildSpan.parentSpanContext?.spanId).toBe(
        taskSpan.spanContext().spanId
      );

      expect(evaluatorSpan.parentSpanContext).toBeUndefined();
      expect(evaluatorSpan.spanContext().traceId).not.toBe(
        taskSpan.spanContext().traceId
      );
      expect(evaluatorChildSpan.spanContext().traceId).toBe(
        evaluatorSpan.spanContext().traceId
      );
      expect(evaluatorChildSpan.parentSpanContext?.spanId).toBe(
        evaluatorSpan.spanContext().spanId
      );

      expect(run.traceId).toBe(taskSpan.spanContext().traceId);
      expect(run.taskEndTime).toBeInstanceOf(Date);
      expect(run.annotations).toEqual([
        expect.objectContaining({
          name: "quality",
          score: true,
          traceId: evaluatorSpan.spanContext().traceId,
        }),
      ]);
    } finally {
      await teardownSuite(harness.suite);
    }
  });

  it("does not mark the task span as failed when a later assertion fails", async () => {
    const harness = createTracingHarness();
    const run = createRunState(harness.suite);

    try {
      await runStorage.run(run, async () => {
        const outcome = await runTaskWithTracing(
          harness.suite,
          "fails after output",
          async () => {
            recordOutput({ answer: "hello" });
            throw new Error("assertion failed");
          }
        );

        expect("error" in outcome).toBe(true);
        if ("error" in outcome) {
          expect(outcome.isTaskError).toBe(false);
        }
      });

      const taskSpan = findEndedSpan(
        harness.endedSpans,
        "Test: fails after output"
      );
      expect(taskSpan.status.code).toBe(SpanStatusCode.OK);
    } finally {
      await teardownSuite(harness.suite);
    }
  });
});

function createTracingHarness(): {
  suite: SuiteState;
  events: string[];
  endedSpans: EndedSpan[];
} {
  const events: string[] = [];
  const endedSpans: EndedSpan[] = [];
  const processor: SpanProcessor = {
    onStart: (span) => {
      events.push(`start:${span.name}`);
    },
    onEnd: (span) => {
      events.push(`end:${span.name}`);
      endedSpans.push(span);
    },
    forceFlush: async () => {},
    shutdown: async () => {},
  };
  const provider = register({
    projectName: "phoenix-client-test-tracing",
    url: "http://localhost:6006/v1/traces",
    spanProcessors: [processor],
    global: false,
  });
  const globalRegistration = attachGlobalTracerProvider(provider);
  const suite = createSuiteState({ provider, globalRegistration });

  return { suite, events, endedSpans };
}

function createSuiteState({
  provider,
  globalRegistration,
}: {
  provider: NodeTracerProvider;
  globalRegistration: GlobalTracerProviderRegistration;
}): SuiteState {
  return {
    name: "tracing suite",
    config: {},
    registeredExamples: new Map(),
    exampleIdsByTest: new Map(),
    trackingDisabled: false,
    results: [],
    links: [],
    tracer: provider.getTracer("tasks"),
    evaluatorTracer: provider.getTracer("evaluators"),
    tracerProvider: provider,
    globalRegistration,
  };
}

function createRunState(suite: SuiteState): RunState {
  return {
    suite,
    testName: "answers question",
    logicalName: "answers question",
    repetitionNumber: 1,
    dryRun: false,
    params: {
      input: { question: "say hello" },
      expected: { answer: "hello" },
    },
    output: undefined,
    outputSet: false,
    annotations: [],
    startTime: new Date(),
    runMetadata: {},
  };
}

function findEndedSpan(endedSpans: EndedSpan[], name: string): EndedSpan {
  const span = endedSpans.find((candidate) => candidate.name === name);
  if (!span) {
    throw new Error(`Expected span "${name}" to end`);
  }
  return span;
}
