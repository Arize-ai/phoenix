import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { context, trace } from "@opentelemetry/api";
import type { Span, SpanProcessor } from "@opentelemetry/sdk-trace-node";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { DiagLogLevel } from "../src";
import {
  attachGlobalTracerProvider,
  detachGlobalTracerProvider,
  ensureCollectorEndpoint,
  register,
  resetTraceExportSourceLogForTesting,
} from "../src/register";

afterEach(() => {
  detachGlobalTracerProvider();
});

describe("register", () => {
  beforeEach(() => {
    resetTraceExportSourceLogForTesting();
  });

  // Falling back to PHOENIX_ENDPOINT sends spans to the server the user named,
  // so it is not a misconfiguration — but where spans go is worth stating,
  // because the batching exporter swallows delivery failures.
  test("should note the variable when trace export falls back to PHOENIX_ENDPOINT", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.PHOENIX_ENDPOINT = "https://phoenix.example.com";
    try {
      register({ global: false });
      const message = info.mock.calls.map((call) => call[0]).join("\n");
      expect(message).toContain("PHOENIX_ENDPOINT");
      expect(message).toContain("https://phoenix.example.com/v1/traces");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      delete process.env.PHOENIX_ENDPOINT;
      info.mockRestore();
      warn.mockRestore();
    }
  });

  test("should stay quiet when PHOENIX_COLLECTOR_ENDPOINT supplies the endpoint", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    process.env.PHOENIX_ENDPOINT = "https://phoenix.example.com";
    process.env.PHOENIX_COLLECTOR_ENDPOINT = "https://phoenix.example.com";
    try {
      register({ global: false });
      expect(info).not.toHaveBeenCalled();
    } finally {
      delete process.env.PHOENIX_ENDPOINT;
      delete process.env.PHOENIX_COLLECTOR_ENDPOINT;
      info.mockRestore();
    }
  });

  test("should note the fallback variable only once", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    process.env.PHOENIX_ENDPOINT = "https://phoenix.example.com";
    try {
      register({ global: false });
      register({ global: false });
      expect(info).toHaveBeenCalledOnce();
    } finally {
      delete process.env.PHOENIX_ENDPOINT;
      info.mockRestore();
    }
  });

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

test("register uses the env project name as a fallback", () => {
  delete process.env.PHOENIX_PROJECT_NAME;
  process.env.PHOENIX_PROJECT = "env-project";
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
    delete process.env.PHOENIX_PROJECT;
  }
});

test("should export DiagLogLevel as a runtime value", () => {
  expect(DiagLogLevel.DEBUG).toBeDefined();
  expect(typeof DiagLogLevel.DEBUG).toBe("number");
});

test.each([
  ["http://localhost:6006", "http://localhost:6006/v1/traces"],
  ["http://localhost:6006/", "http://localhost:6006/v1/traces"],
  ["http://localhost:6006/v1/traces", "http://localhost:6006/v1/traces"],
  // A trailing slash or doubled separator is canonicalized so the exporter
  // reaches the route directly instead of through a redirect.
  ["http://localhost:6006/v1/traces/", "http://localhost:6006/v1/traces"],
  ["http://localhost:6006//v1/traces", "http://localhost:6006/v1/traces"],
  [
    "http://localhost:6006/v1/traces?tenant=a",
    "http://localhost:6006/v1/traces?tenant=a",
  ],
  // URL paths are case-sensitive, so an upper-case path is somebody's real
  // route rather than the OTLP one.
  [
    "http://localhost:6006/V1/traces",
    "http://localhost:6006/V1/traces/v1/traces",
  ],
  // A route that merely contains the traces path is left alone; appending
  // would break it.
  [
    "https://gateway.example.com/v1/traces/tenant-a",
    "https://gateway.example.com/v1/traces/tenant-a",
  ],
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
  // Normalization is idempotent: re-running it never moves the URL again.
  expect(ensureCollectorEndpoint(collectorURL)).toBe(collectorURL);
});
