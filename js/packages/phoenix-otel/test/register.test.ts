import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { context, trace } from "@opentelemetry/api";
import type { Span, SpanProcessor } from "@opentelemetry/sdk-trace-node";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { DiagLogLevel } from "../src";
import { getEnvProjectName } from "../src/config";
import {
  attachGlobalTracerProvider,
  detachGlobalTracerProvider,
  ensureCollectorEndpoint,
  register,
} from "../src/register";

afterEach(() => {
  detachGlobalTracerProvider();
});

describe("register", () => {
  test("should register a provider and invoke custom span processor", () => {
    let onStartCalls = 0;
    const mockProcessor: SpanProcessor = {
      onStart: () => {
        onStartCalls += 1;
      },
      onEnd: (_span: Readonly<Span>) => {},
      forceFlush: async () => {},
      shutdown: async () => {},
    };
    const provider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [mockProcessor],
      global: false,
    });
    expect(provider).toBeDefined();

    const tracer = provider.getTracer("register-test");
    tracer.startSpan("smoke-span", undefined, context.active()).end();
    expect(onStartCalls).toBe(1);
  });

  test("should accept diag log level from package exports", () => {
    const provider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      diagLogLevel: DiagLogLevel.DEBUG,
      global: false,
    });
    expect(provider).toBeDefined();
  });

  test("should detach the global tracer provider so a new one can be attached", async () => {
    let firstProviderStarts = 0;
    let secondProviderStarts = 0;
    const firstProcessor: SpanProcessor = {
      onStart: () => {
        firstProviderStarts += 1;
      },
      onEnd: () => {},
      forceFlush: async () => {},
      shutdown: async () => {},
    };
    const secondProcessor: SpanProcessor = {
      onStart: () => {
        secondProviderStarts += 1;
      },
      onEnd: () => {},
      forceFlush: async () => {},
      shutdown: async () => {},
    };

    const firstProvider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [firstProcessor],
      global: false,
    });
    const secondProvider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [secondProcessor],
      global: false,
    });

    const firstRegistration = attachGlobalTracerProvider(firstProvider);
    trace.getTracer("global-test").startSpan("first-span").end();

    expect(firstProviderStarts).toBe(1);
    expect(secondProviderStarts).toBe(0);

    firstRegistration.detach();

    const secondRegistration = attachGlobalTracerProvider(secondProvider);
    trace.getTracer("global-test").startSpan("second-span").end();

    expect(firstProviderStarts).toBe(1);
    expect(secondProviderStarts).toBe(1);

    secondRegistration.detach();
    await firstProvider.shutdown();
    await secondProvider.shutdown();
  });

  test("should restore a previously mounted global tracer provider", async () => {
    let externalStarts = 0;
    let mountedStarts = 0;
    const externalProcessor: SpanProcessor = {
      onStart: () => {
        externalStarts += 1;
      },
      onEnd: () => {},
      forceFlush: async () => {},
      shutdown: async () => {},
    };
    const mountedProcessor: SpanProcessor = {
      onStart: () => {
        mountedStarts += 1;
      },
      onEnd: () => {},
      forceFlush: async () => {},
      shutdown: async () => {},
    };

    const externalProvider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [externalProcessor],
      global: false,
    });
    const mountedProvider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [mountedProcessor],
      global: false,
    });

    externalProvider.register();
    trace.getTracer("global-test").startSpan("external-before").end();

    const mountedRegistration = attachGlobalTracerProvider(mountedProvider);
    trace.getTracer("global-test").startSpan("mounted").end();

    mountedRegistration.detach();
    trace.getTracer("global-test").startSpan("external-after").end();

    expect(externalStarts).toBe(2);
    expect(mountedStarts).toBe(1);

    await externalProvider.shutdown();
    await mountedProvider.shutdown();
  });

  test("should detach managed global mounts when a registered provider shuts down", async () => {
    let firstStarts = 0;
    let secondStarts = 0;
    const firstProcessor: SpanProcessor = {
      onStart: () => {
        firstStarts += 1;
      },
      onEnd: () => {},
      forceFlush: async () => {},
      shutdown: async () => {},
    };
    const secondProcessor: SpanProcessor = {
      onStart: () => {
        secondStarts += 1;
      },
      onEnd: () => {},
      forceFlush: async () => {},
      shutdown: async () => {},
    };

    const firstProvider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [firstProcessor],
      global: true,
    });
    const secondProvider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [secondProcessor],
      global: true,
    });

    trace.getTracer("global-test").startSpan("second-active").end();
    await firstProvider.shutdown();

    detachGlobalTracerProvider();
    trace.getTracer("global-test").startSpan("after-detach").end();

    expect(firstStarts).toBe(0);
    expect(secondStarts).toBe(1);

    await secondProvider.shutdown();
  });

  test("should ignore out-of-order detach and restore the remaining top mount", async () => {
    let firstStarts = 0;
    let secondStarts = 0;
    const firstProcessor: SpanProcessor = {
      onStart: () => {
        firstStarts += 1;
      },
      onEnd: () => {},
      forceFlush: async () => {},
      shutdown: async () => {},
    };
    const secondProcessor: SpanProcessor = {
      onStart: () => {
        secondStarts += 1;
      },
      onEnd: () => {},
      forceFlush: async () => {},
      shutdown: async () => {},
    };

    const firstProvider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [firstProcessor],
      global: false,
    });
    const secondProvider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [secondProcessor],
      global: false,
    });

    const firstRegistration = attachGlobalTracerProvider(firstProvider);
    const secondRegistration = attachGlobalTracerProvider(secondProvider);

    firstRegistration.detach();
    trace.getTracer("global-test").startSpan("second-still-active").end();
    secondRegistration.detach();
    trace.getTracer("global-test").startSpan("no-provider").end();

    expect(firstStarts).toBe(0);
    expect(secondStarts).toBe(1);

    await firstProvider.shutdown();
    await secondProvider.shutdown();
  });
});

describe("getEnvProjectName", () => {
  beforeEach(() => {
    delete process.env.PHOENIX_PROJECT_NAME;
    delete process.env.PHOENIX_PROJECT;
  });

  afterEach(() => {
    delete process.env.PHOENIX_PROJECT_NAME;
    delete process.env.PHOENIX_PROJECT;
  });

  test("returns undefined when neither variable is set", () => {
    expect(getEnvProjectName()).toBeUndefined();
  });

  test("reads PHOENIX_PROJECT_NAME when only it is set", () => {
    process.env.PHOENIX_PROJECT_NAME = "canonical";
    expect(getEnvProjectName()).toBe("canonical");
  });

  test("reads PHOENIX_PROJECT when only the alias is set", () => {
    process.env.PHOENIX_PROJECT = "alias";
    expect(getEnvProjectName()).toBe("alias");
  });

  test("prefers PHOENIX_PROJECT_NAME over PHOENIX_PROJECT", () => {
    process.env.PHOENIX_PROJECT_NAME = "canonical";
    process.env.PHOENIX_PROJECT = "alias";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getEnvProjectName()).toBe("canonical");
    // Conflicting values emit a one-time warning naming both.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("PHOENIX_PROJECT_NAME");
    expect(warn.mock.calls[0]?.[0]).toContain("PHOENIX_PROJECT");
    warn.mockRestore();
  });
});

test("register uses the env project name as a fallback", () => {
  delete process.env.PHOENIX_PROJECT;
  process.env.PHOENIX_PROJECT_NAME = "env-project";
  try {
    let capturedProjectName: unknown;
    const captureProcessor: SpanProcessor = {
      onStart: (span: Readonly<Span>) => {
        capturedProjectName =
          span.resource.attributes[SEMRESATTRS_PROJECT_NAME];
      },
      onEnd: () => {},
      forceFlush: async () => {},
      shutdown: async () => {},
    };
    const provider = register({
      url: "http://localhost:6006/v1/traces",
      apiKey: "test",
      spanProcessors: [captureProcessor],
      global: false,
    });
    provider
      .getTracer("env-project-test")
      .startSpan("smoke-span", undefined, context.active())
      .end();
    expect(capturedProjectName).toBe("env-project");
  } finally {
    delete process.env.PHOENIX_PROJECT_NAME;
  }
});

test("should export DiagLogLevel as a runtime value", () => {
  expect(DiagLogLevel.DEBUG).toBeDefined();
  expect(typeof DiagLogLevel.DEBUG).toBe("number");
});

test.each([
  ["http://localhost:6006", "http://localhost:6006/v1/traces"],
  ["http://localhost:6006/v1/traces", "http://localhost:6006/v1/traces"],
  ["http://localhost:6006/v1/traces/", "http://localhost:6006/v1/traces/"],
  [
    "https://app.phoenix.arize.com/s/my-space",
    "https://app.phoenix.arize.com/s/my-space/v1/traces",
  ],
  [
    "https://app.phoenix.arize.com/s/my-space/v1/traces",
    "https://app.phoenix.arize.com/s/my-space/v1/traces",
  ],
])("ensureCollectorEndpoint(%0) should return %1", (url, collectorURL) => {
  expect(ensureCollectorEndpoint(url)).toBe(collectorURL);
});
