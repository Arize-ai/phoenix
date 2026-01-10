/**
 * Tests for Phoenix Insight observability functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initializeObservability,
  shutdownObservability,
  isObservabilityEnabled,
  getTracerProvider,
} from "../src/observability/index.js";

// Mock the phoenix-otel register function
vi.mock("@arizeai/phoenix-otel", () => ({
  register: vi.fn(() => ({
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock DiagLogLevel from opentelemetry
vi.mock("@opentelemetry/api", () => ({
  DiagLogLevel: {
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
  },
}));

describe("observability", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    // Reset between tests
    consoleErrorSpy.mockClear();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup after each test
    await shutdownObservability();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup after each test
    await shutdownObservability();
  });

  it("should not initialize when disabled", () => {
    initializeObservability({
      enabled: false,
    });

    expect(isObservabilityEnabled()).toBe(false);
    expect(getTracerProvider()).toBe(null);
  });

  it("should initialize when enabled", async () => {
    const { register } = await import("@arizeai/phoenix-otel");

    initializeObservability({
      enabled: true,
      baseUrl: "http://localhost:6006",
      apiKey: "test-key",
      projectName: "test-project",
    });

    expect(isObservabilityEnabled()).toBe(true);
    expect(getTracerProvider()).not.toBe(null);
    expect(register).toHaveBeenCalledWith({
      projectName: "test-project",
      url: "http://localhost:6006",
      apiKey: "test-key",
      batch: true,
      global: true,
      diagLogLevel: undefined,
    });
  });

  it("should use default project name when not provided", async () => {
    const { register } = await import("@arizeai/phoenix-otel");

    initializeObservability({
      enabled: true,
    });

    expect(register).toHaveBeenCalledWith({
      projectName: "phoenix-insight",
      url: undefined,
      apiKey: undefined,
      batch: true,
      global: true,
      diagLogLevel: undefined,
    });
  });

  it("should enable debug logging when debug is true", async () => {
    const { register } = await import("@arizeai/phoenix-otel");
    const { DiagLogLevel } = await import("@opentelemetry/api");

    initializeObservability({
      enabled: true,
      debug: true,
    });

    expect(register).toHaveBeenCalledWith({
      projectName: "phoenix-insight",
      url: undefined,
      apiKey: undefined,
      batch: true,
      global: true,
      diagLogLevel: DiagLogLevel.DEBUG,
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "🔭 Observability enabled - traces will be sent to Phoenix"
    );
  });

  it("should not initialize twice", async () => {
    const { register } = await import("@arizeai/phoenix-otel");

    initializeObservability({
      enabled: true,
    });

    const firstProvider = getTracerProvider();

    // Try to initialize again
    initializeObservability({
      enabled: true,
      projectName: "different-project",
    });

    // Should still have the same provider
    expect(getTracerProvider()).toBe(firstProvider);
    // Should only be called once
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("should handle initialization errors gracefully", async () => {
    const { register } = await import("@arizeai/phoenix-otel");

    // Make register throw an error
    vi.mocked(register).mockImplementationOnce(() => {
      throw new Error("Test initialization error");
    });

    // Should not throw
    expect(() => {
      initializeObservability({
        enabled: true,
      });
    }).not.toThrow();

    // Should log the error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "⚠️  Failed to initialize observability:",
      expect.any(Error)
    );

    // Should not be enabled
    expect(isObservabilityEnabled()).toBe(false);
  });

  it("should shutdown gracefully", async () => {
    initializeObservability({
      enabled: true,
    });

    const provider = getTracerProvider();
    expect(provider).not.toBe(null);

    await shutdownObservability();

    expect(isObservabilityEnabled()).toBe(false);
    expect(getTracerProvider()).toBe(null);
    expect(provider!.shutdown).toHaveBeenCalled();
  });

  it("should handle shutdown errors gracefully", async () => {
    initializeObservability({
      enabled: true,
    });

    const provider = getTracerProvider();
    // Make shutdown throw an error
    vi.mocked(provider!.shutdown).mockRejectedValueOnce(
      new Error("Test shutdown error")
    );

    // Should not throw
    await expect(shutdownObservability()).resolves.not.toThrow();

    // Should log the error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "⚠️  Error shutting down observability:",
      expect.any(Error)
    );
  });

  it("should handle shutdown when not initialized", async () => {
    // Should not throw when provider is null
    await expect(shutdownObservability()).resolves.not.toThrow();
  });
});
