import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { questionMock, closeMock } = vi.hoisted(() => ({
  questionMock: vi.fn(),
  closeMock: vi.fn(),
}));

vi.mock("readline", () => ({
  createInterface: vi.fn(() => ({
    question: questionMock,
    close: closeMock,
  })),
}));

import * as readline from "readline";
import { confirmAction, confirmOrExit } from "../src/confirm";
import { ExitCode } from "../src/exitCodes";

function mockAnswer(answer: string) {
  questionMock.mockImplementation(
    (_prompt: string, cb: (answer: string) => void) => cb(answer)
  );
}

describe("confirmAction", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when user answers "y"', async () => {
    mockAnswer("y");
    expect(await confirmAction("Continue?")).toBe(true);
  });

  it('returns true when user answers "yes"', async () => {
    mockAnswer("yes");
    expect(await confirmAction("Continue?")).toBe(true);
  });

  it('returns true for mixed-case "YES"', async () => {
    mockAnswer("YES");
    expect(await confirmAction("Continue?")).toBe(true);
  });

  it('returns true for mixed-case "Yes"', async () => {
    mockAnswer("Yes");
    expect(await confirmAction("Continue?")).toBe(true);
  });

  it('returns false when user answers "n"', async () => {
    mockAnswer("n");
    expect(await confirmAction("Continue?")).toBe(false);
  });

  it("returns false when user answers with empty string", async () => {
    mockAnswer("");
    expect(await confirmAction("Continue?")).toBe(false);
  });

  it("returns false for any other input", async () => {
    mockAnswer("sure");
    expect(await confirmAction("Continue?")).toBe(false);
  });

  it("uses stderr as output (not stdout)", async () => {
    mockAnswer("y");
    await confirmAction("Continue?");

    expect(vi.mocked(readline.createInterface)).toHaveBeenCalledWith(
      expect.objectContaining({
        input: process.stdin,
        output: process.stderr,
      })
    );
  });

  it("formats prompt with [y/N] suffix", async () => {
    let capturedPrompt = "";
    questionMock.mockImplementation(
      (prompt: string, cb: (answer: string) => void) => {
        capturedPrompt = prompt;
        cb("y");
      }
    );

    await confirmAction("Delete this?");
    expect(capturedPrompt).toBe("Delete this? [y/N] ");
  });
});

describe("confirmOrExit", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY;
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
    stderrWriteSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((() => true) as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });

  it("resolves immediately when yes=true (skips prompt)", async () => {
    await confirmOrExit({ message: "Delete?", yes: true });

    expect(vi.mocked(readline.createInterface)).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("exits with INVALID_ARGUMENT when stdin is not a TTY and yes is not set", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    await expect(confirmOrExit({ message: "Delete?" })).rejects.toThrow(
      `process.exit:${ExitCode.INVALID_ARGUMENT}`
    );
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });

  it("writes error message mentioning --yes when non-TTY", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    await expect(confirmOrExit({ message: "Delete?" })).rejects.toThrow();
    expect(stderrWriteSpy).toHaveBeenCalledWith(
      expect.stringContaining("--yes")
    );
  });

  it("exits with CANCELLED when user declines on a TTY", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
    mockAnswer("n");

    await expect(confirmOrExit({ message: "Delete?" })).rejects.toThrow(
      `process.exit:${ExitCode.CANCELLED}`
    );
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.CANCELLED);
  });

  it("resolves when user confirms with 'y' on a TTY", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
    mockAnswer("y");

    await expect(
      confirmOrExit({ message: "Delete?" })
    ).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("resolves when user confirms with 'yes' on a TTY", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
    mockAnswer("yes");

    await expect(
      confirmOrExit({ message: "Delete?" })
    ).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("yes=false still requires TTY prompt and exits on decline", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
    mockAnswer("n");

    await expect(
      confirmOrExit({ message: "Delete?", yes: false })
    ).rejects.toThrow(`process.exit:${ExitCode.CANCELLED}`);
  });
});
