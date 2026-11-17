import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace";
import {
  BatchSpanProcessor as SdkBatchSpanProcessor,
  InMemorySpanExporter,
  SimpleSpanProcessor as SdkSimpleSpanProcessor,
} from "@opentelemetry/sdk-trace";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  AlwaysOffSampler,
  BatchSpanProcessor,
  ParentBasedSampler,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
} from "../src";
import {
  detachGlobalTracerProvider,
  register,
  resetIgnoredOtelEnvVarWarningsForTesting,
} from "../src/register";

const IGNORED_ENV_KEYS = [
  "OTEL_TRACES_SAMPLER",
  "OTEL_TRACES_SAMPLER_ARG",
  "OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT",
  "OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT",
  "OTEL_SPAN_EVENT_COUNT_LIMIT",
  "OTEL_BSP_SCHEDULE_DELAY",
  "OTEL_BSP_MAX_QUEUE_SIZE",
];

afterEach(() => {
  detachGlobalTracerProvider();
  for (const key of IGNORED_ENV_KEYS) {
    delete process.env[key];
  }
});

describe("register sampler and spanLimits", () => {
  test("applies the sampler to spans the provider creates", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = register({
      global: false,
      sampler: new AlwaysOffSampler(),
      spanProcessors: [new SimpleSpanProcessor({ exporter })],
    });

    const span = provider.getTracer("test").startSpan("sampled-out");
    expect(span.isRecording()).toBe(false);
    span.end();

    await provider.forceFlush();
    expect(exporter.getFinishedSpans()).toHaveLength(0);
    await provider.shutdown();
  });

  test("keeps the default always-on sampling when no sampler is passed", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = register({
      global: false,
      spanProcessors: [new SimpleSpanProcessor({ exporter })],
    });

    provider.getTracer("test").startSpan("recorded").end();

    await provider.forceFlush();
    expect(exporter.getFinishedSpans().map((span) => span.name)).toEqual([
      "recorded",
    ]);
    await provider.shutdown();
  });

  test("applies span limits to span attributes", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = register({
      global: false,
      spanLimits: { attributeCountLimit: 1, attributeValueLengthLimit: 3 },
      spanProcessors: [new SimpleSpanProcessor({ exporter })],
    });

    provider
      .getTracer("test")
      .startSpan("limited", { attributes: { first: "abcdef", second: "x" } })
      .end();

    await provider.forceFlush();
    const [span] = exporter.getFinishedSpans() as ReadableSpan[];
    expect(span?.attributes).toEqual({ first: "abc" });
    await provider.shutdown();
  });

  test("re-exports the standard samplers", () => {
    const sampler = new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(0.5),
    });
    expect(sampler.toString()).toContain("TraceIdRatioBased");
  });
});

describe("register warns about OTEL_* variables OpenTelemetry JS 3 ignores", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetIgnoredOtelEnvVarWarningsForTesting();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  const warnings = () => warn.mock.calls.map((call) => String(call[0]));

  test("warns when OTEL_TRACES_SAMPLER is set and no sampler is passed", async () => {
    process.env.OTEL_TRACES_SAMPLER = "always_off";
    const provider = register({ global: false, spanProcessors: [] });

    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain("OTEL_TRACES_SAMPLER");
    expect(warnings()[0]).toContain("`sampler` option");
    await provider.shutdown();
  });

  test("names every set variable of a group in one warning", async () => {
    process.env.OTEL_TRACES_SAMPLER = "traceidratio";
    process.env.OTEL_TRACES_SAMPLER_ARG = "0.1";
    const provider = register({ global: false, spanProcessors: [] });

    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain(
      "OTEL_TRACES_SAMPLER, OTEL_TRACES_SAMPLER_ARG are set but ignored"
    );
    await provider.shutdown();
  });

  test("warns about span limit and batch variables with their replacements", async () => {
    process.env.OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT = "10";
    process.env.OTEL_BSP_SCHEDULE_DELAY = "100";
    const provider = register({ global: false, url: "http://localhost:6006" });

    const message = warnings().join("\n");
    expect(message).toContain("OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT");
    expect(message).toContain("`spanLimits` option");
    expect(message).toContain("OTEL_BSP_SCHEDULE_DELAY");
    expect(message).toContain("BatchSpanProcessor");
    await provider.shutdown();
  });

  test("stays quiet for a group the call configures in code", async () => {
    process.env.OTEL_TRACES_SAMPLER = "always_off";
    process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = "100";
    process.env.OTEL_BSP_SCHEDULE_DELAY = "100";
    const provider = register({
      global: false,
      sampler: new AlwaysOffSampler(),
      spanLimits: { attributeValueLengthLimit: 100 },
      spanProcessors: [],
    });

    expect(warn).not.toHaveBeenCalled();
    await provider.shutdown();
  });

  test("warns about span limit variables whose spanLimits field is not set", async () => {
    process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = "100";
    process.env.OTEL_SPAN_EVENT_COUNT_LIMIT = "5";
    const provider = register({
      global: false,
      spanLimits: { attributeValueLengthLimit: 4096 },
      spanProcessors: [],
    });

    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain("OTEL_SPAN_EVENT_COUNT_LIMIT is set");
    expect(warnings()[0]).not.toContain("OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT");
    await provider.shutdown();
  });

  test("does not warn about OTEL_BSP_* for the default simple processor", async () => {
    process.env.OTEL_BSP_SCHEDULE_DELAY = "100";
    const provider = register({
      global: false,
      batch: false,
      url: "http://localhost:6006",
    });

    expect(warn).not.toHaveBeenCalled();
    await provider.shutdown();
  });

  test("BatchSpanProcessor warns about OTEL_BSP_* variables whose option is left out", async () => {
    process.env.OTEL_BSP_SCHEDULE_DELAY = "100";
    process.env.OTEL_BSP_MAX_QUEUE_SIZE = "10";
    const processor = new BatchSpanProcessor({
      exporter: new InMemorySpanExporter(),
      maxQueueSize: 10,
    });

    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain("OTEL_BSP_SCHEDULE_DELAY is set");
    expect(warnings()[0]).not.toContain("OTEL_BSP_MAX_QUEUE_SIZE");
    expect(warnings()[0]).toContain("new BatchSpanProcessor");
    await processor.shutdown();
  });

  test("warns about each variable only once per process", async () => {
    process.env.OTEL_TRACES_SAMPLER = "always_off";
    const first = register({ global: false, spanProcessors: [] });
    const second = register({ global: false, spanProcessors: [] });

    expect(warn).toHaveBeenCalledOnce();
    await first.shutdown();
    await second.shutdown();
  });

  test("stays quiet when none of the variables are set", async () => {
    const provider = register({ global: false, spanProcessors: [] });
    expect(warn).not.toHaveBeenCalled();
    await provider.shutdown();
  });
});

describe("re-exported span processors", () => {
  const exporter = (): SpanExporter => new InMemorySpanExporter();

  test.each([
    ["BatchSpanProcessor", BatchSpanProcessor],
    ["SimpleSpanProcessor", SimpleSpanProcessor],
  ] as const)(
    "%s throws a descriptive error for the 2.x positional exporter form",
    (name, Processor) => {
      const construct = () =>
        new Processor(exporter() as unknown as { exporter: SpanExporter });
      expect(construct).toThrow(TypeError);
      expect(construct).toThrow(
        `use new ${name}({ exporter }) instead of new ${name}(exporter)`
      );
    }
  );

  test.each([
    ["BatchSpanProcessor", BatchSpanProcessor],
    ["SimpleSpanProcessor", SimpleSpanProcessor],
  ] as const)("%s throws when no exporter is given", (name, Processor) => {
    expect(
      () => new Processor(undefined as unknown as { exporter: SpanExporter })
    ).toThrow(`${name} requires an exporter`);
  });

  test("are the SDK processor classes", async () => {
    const batch = new BatchSpanProcessor({ exporter: exporter() });
    const simple = new SimpleSpanProcessor({ exporter: exporter() });
    expect(batch).toBeInstanceOf(SdkBatchSpanProcessor);
    expect(simple).toBeInstanceOf(SdkSimpleSpanProcessor);
    await batch.shutdown();
    await simple.shutdown();
  });

  test("export spans when given the options object", async () => {
    const memory = new InMemorySpanExporter();
    const provider = register({
      global: false,
      spanProcessors: [
        new BatchSpanProcessor({ exporter: memory, scheduledDelayMillis: 10 }),
      ],
    });

    provider.getTracer("test").startSpan("batched").end();

    await provider.forceFlush();
    expect(memory.getFinishedSpans().map((span) => span.name)).toEqual([
      "batched",
    ]);
    await provider.shutdown();
  });
});
