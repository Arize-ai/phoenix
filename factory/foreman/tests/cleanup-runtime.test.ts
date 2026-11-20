import { DatabaseError } from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { register } from "../src/instrumentation";

const cleanup = vi.hoisted(() => vi.fn<() => Promise<void>>());
vi.mock("../src/mcp/cleanup", () => ({ deleteExpiredMcpGrants: cleanup }));
const runtime = globalThis as typeof globalThis & {
  factoryMcpGrantCleanup?: unknown;
};
const HOUR_MS = 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  delete runtime.factoryMcpGrantCleanup;
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  cleanup.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete runtime.factoryMcpGrantCleanup;
});

it("registers one hourly cleanup from Node startup without requiring a request", async () => {
  await register();
  await register();
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(HOUR_MS - 1);
  expect(cleanup).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(cleanup).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(HOUR_MS);
  expect(cleanup).toHaveBeenCalledTimes(2);
});

it("does not initialize the Node cleanup in the Edge runtime", async () => {
  vi.stubEnv("NEXT_RUNTIME", "edge");
  await register();
  expect(vi.getTimerCount()).toBe(0);
  expect(cleanup).not.toHaveBeenCalled();
});

it("does not overlap slow cleanup runs", async () => {
  let finishCleanup: (() => void) | undefined;
  cleanup.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishCleanup = resolve;
      })
  );
  await register();
  vi.advanceTimersByTime(HOUR_MS);
  vi.advanceTimersByTime(HOUR_MS);
  expect(cleanup).toHaveBeenCalledTimes(1);
  finishCleanup!();
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(HOUR_MS);
  expect(cleanup).toHaveBeenCalledTimes(2);
});

it.each([
  new DatabaseError("internal database details", 0, "error"),
  Object.assign(new Error("internal connection details"), {
    code: "ECONNREFUSED",
  }),
])(
  "retries database failures next hour without logging internal details",
  async (error) => {
    const log = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    cleanup.mockRejectedValueOnce(error);
    await register();
    await vi.advanceTimersByTimeAsync(HOUR_MS);
    expect(log).toHaveBeenCalledExactlyOnceWith(
      "Expired MCP grant cleanup failed; retrying next hour.\n"
    );
    await vi.advanceTimersByTimeAsync(HOUR_MS);
    expect(cleanup).toHaveBeenCalledTimes(2);
  }
);

it("does not swallow unexpected programming errors", async () => {
  const interval = vi.spyOn(globalThis, "setInterval");
  cleanup.mockRejectedValueOnce(new TypeError("Unexpected cleanup failure"));
  await register();
  const run = interval.mock.calls[0][0] as () => Promise<void>;
  await expect(run()).rejects.toThrow("Unexpected cleanup failure");
});
