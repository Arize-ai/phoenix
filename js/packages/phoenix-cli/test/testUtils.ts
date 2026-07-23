import { DEFAULT_MOCK_BASE_URL } from "@arizeai/phoenix-testing";
import { vi } from "vitest";

/**
 * Connection args pointing a command under test at the mock Phoenix server,
 * with progress output suppressed. Extend per-file when a command needs more:
 * `[...BASE_ARGS, "--yes"]`.
 */
export const BASE_ARGS = ["--endpoint", DEFAULT_MOCK_BASE_URL, "--no-progress"];

/**
 * Replace `process.exit` with a spy that throws `process.exit:<code>` so a
 * command's exit path can be asserted with
 * `rejects.toThrow(`process.exit:${ExitCode.FAILURE}`)` and
 * `expect(exitSpy).toHaveBeenCalledWith(...)`. Restored by
 * `vi.restoreAllMocks()`.
 */
export function mockProcessExit() {
  return vi
    .spyOn(process, "exit")
    .mockImplementation((code?: number): never => {
      throw new Error(`process.exit:${code}`);
    });
}

/**
 * Silence and capture the CLI's stdout/stderr for the current test. The CLI
 * writes data to stdout via `console.log` and errors/progress to stderr via
 * `console.error` (see `src/io.ts`), so tests assert on
 * `io.stdout.mock.calls` / `io.stderr.mock.calls`. Restored by
 * `vi.restoreAllMocks()`.
 */
export function captureCliOutput() {
  return {
    stdout: vi.spyOn(console, "log").mockImplementation(() => {}),
    stderr: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
}
