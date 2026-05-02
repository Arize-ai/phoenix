import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cancelMock, confirmMock, isCancelMock } = vi.hoisted(() => ({
  cancelMock: vi.fn(),
  confirmMock: vi.fn(),
  isCancelMock: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  cancel: cancelMock,
  confirm: confirmMock,
  isCancel: isCancelMock,
}));

import {
  assertDeletesEnabled,
  confirmAction,
  confirmOrExit,
  ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES,
  parseBooleanEnvironmentVariable,
} from "../src/confirm";
import { ExitCode, InvalidArgumentError } from "../src/exitCodes";

describe("confirmAction", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the prompt confirms", async () => {
    confirmMock.mockResolvedValue(true);
    isCancelMock.mockReturnValue(false);

    expect(await confirmAction("Continue?")).toBe(true);
  });

  it("returns false when the prompt declines", async () => {
    confirmMock.mockResolvedValue(false);
    isCancelMock.mockReturnValue(false);

    expect(await confirmAction("Continue?")).toBe(false);
  });

  it("returns false and cancels when the prompt is cancelled", async () => {
    const cancelToken = Symbol("cancel");
    confirmMock.mockResolvedValue(cancelToken);
    isCancelMock.mockReturnValue(true);

    await expect(confirmAction("Continue?")).resolves.toBe(false);
    expect(cancelMock).toHaveBeenCalledWith("Operation cancelled");
  });

  it("passes clack prompt configuration through", async () => {
    confirmMock.mockResolvedValue(true);
    isCancelMock.mockReturnValue(false);

    await confirmAction("Delete this?");

    expect(confirmMock).toHaveBeenCalledWith({
      message: "Delete this?",
      initialValue: false,
      active: "Yes",
      inactive: "No",
    });
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

    expect(confirmMock).not.toHaveBeenCalled();
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
    confirmMock.mockResolvedValue(false);
    isCancelMock.mockReturnValue(false);

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
    confirmMock.mockResolvedValue(true);
    isCancelMock.mockReturnValue(false);

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
    confirmMock.mockResolvedValue(true);
    isCancelMock.mockReturnValue(false);

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
    confirmMock.mockResolvedValue(false);
    isCancelMock.mockReturnValue(false);

    await expect(
      confirmOrExit({ message: "Delete?", yes: false })
    ).rejects.toThrow(`process.exit:${ExitCode.CANCELLED}`);
  });
});

describe("parseBooleanEnvironmentVariable", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the default when the env var is not set", () => {
    expect(
      parseBooleanEnvironmentVariable({
        envVar: ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES,
        defaultValue: false,
      })
    ).toBe(false);
  });

  it("parses true values case-insensitively", () => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "TRUE");

    expect(
      parseBooleanEnvironmentVariable({
        envVar: ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES,
        defaultValue: false,
      })
    ).toBe(true);
  });

  it("parses false values case-insensitively", () => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "False");

    expect(
      parseBooleanEnvironmentVariable({
        envVar: ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES,
        defaultValue: true,
      })
    ).toBe(false);
  });

  it.each(["1", "yes", ""])(
    "rejects invalid boolean env values like %s",
    (value) => {
      vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, value);

      expect(() =>
        parseBooleanEnvironmentVariable({
          envVar: ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES,
          defaultValue: false,
        })
      ).toThrow(
        `${ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES} must be set to TRUE or FALSE (case-insensitive). Got: ${value}`
      );
    }
  );
});

describe("assertDeletesEnabled", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("exits when deletes are not enabled", () => {
    expect(() => assertDeletesEnabled()).toThrow(
      new InvalidArgumentError("Delete commands are disabled.")
    );
  });

  it("allows deletes when the env var is true", () => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "true");

    expect(() => assertDeletesEnabled()).not.toThrow();
  });

  it("surfaces invalid env values", () => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "1");

    expect(() => assertDeletesEnabled()).toThrow(
      new InvalidArgumentError(
        `${ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES} must be set to TRUE or FALSE (case-insensitive). Got: 1`
      )
    );
  });
});
