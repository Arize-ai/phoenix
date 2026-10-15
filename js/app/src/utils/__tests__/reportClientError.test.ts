import { RedirectingToLoginError } from "@phoenix/authFetch";

import {
  buildClientErrorReport,
  createClientErrorReporter,
} from "../reportClientError";

describe("buildClientErrorReport", () => {
  it("should take the message and stack from an Error", () => {
    const error = new TypeError("Cannot read properties of undefined");
    const report = buildClientErrorReport({
      error,
      componentStack: "\n    at SpanDetails",
      url: "/projects/abc/spans",
      userAgent: "TestAgent/1.0",
      platformVersion: "20.22.0",
    });
    expect(report).toEqual({
      message: "Cannot read properties of undefined",
      stack: error.stack,
      component_stack: "\n    at SpanDetails",
      url: "/projects/abc/spans",
      user_agent: "TestAgent/1.0",
      platform_version: "20.22.0",
    });
  });

  it("should describe non-Error values", () => {
    expect(buildClientErrorReport({ error: "plain string" }).message).toBe(
      "plain string"
    );
    expect(buildClientErrorReport({ error: { code: 42 } }).message).toBe(
      '{"code":42}'
    );
    expect(buildClientErrorReport({ error: undefined }).message).toBe(
      "Unknown error"
    );
    expect(buildClientErrorReport({ error: null }).stack).toBeNull();
  });

  it("should truncate oversized fields to the server's limits", () => {
    const report = buildClientErrorReport({
      error: new Error("x".repeat(5_000)),
      componentStack: "y".repeat(20_000),
    });
    expect(report.message).toHaveLength(2_000);
    expect(report.component_stack).toHaveLength(16_000);
  });

  it("should default url, user agent, and version from the page", () => {
    const report = buildClientErrorReport({ error: new Error("boom") });
    expect(report.url).toBe(window.location.pathname + window.location.search);
    expect(report.user_agent).toBe(navigator.userAgent);
    expect(report.platform_version).toBe(window.Config.platformVersion);
  });
});

describe("createClientErrorReporter", () => {
  it("should send each distinct error once", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const reportClientError = createClientErrorReporter({ send });
    const error = new Error("render loop");

    reportClientError({ error });
    reportClientError({ error });
    reportClientError({ error: new Error("something else") });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0].message).toBe("render loop");
    expect(send.mock.calls[1][0].message).toBe("something else");
  });

  it("should stop sending after the distinct-error cap", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const reportClientError = createClientErrorReporter({
      send,
      maxDistinctErrors: 2,
    });

    reportClientError({ error: new Error("one") });
    reportClientError({ error: new Error("two") });
    reportClientError({ error: new Error("three") });

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("should swallow a rejected send", async () => {
    const send = vi.fn().mockRejectedValue(new Error("network down"));
    const reportClientError = createClientErrorReporter({ send });

    expect(() => reportClientError({ error: new Error("boom") })).not.toThrow();
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("should swallow a send that throws synchronously", () => {
    const send = vi.fn(() => {
      throw new Error("not even a promise");
    });
    const reportClientError = createClientErrorReporter({ send });

    expect(() => reportClientError({ error: new Error("boom") })).not.toThrow();
  });

  it("should not report the redirect-to-login handoff", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const reportClientError = createClientErrorReporter({ send });

    reportClientError({ error: new RedirectingToLoginError() });

    expect(send).not.toHaveBeenCalled();
  });
});
