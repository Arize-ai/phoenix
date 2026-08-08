import { describe, expect, it, vi } from "vitest";

import {
  getSlashCommandName,
  matchingCommands,
  runSlashCommand,
  SLASH_COMMANDS,
} from "../src/pxi/commands";

describe("SLASH_COMMANDS", () => {
  it("includes clear, exit, and help", () => {
    const names = SLASH_COMMANDS.map((c) => c.name);
    expect(names).toContain("clear");
    expect(names).toContain("exit");
    expect(names).toContain("help");
  });
});

describe("runSlashCommand", () => {
  it("calls clearMessages for /clear", () => {
    const clearMessages = vi.fn();
    const result = runSlashCommand("/clear", { clearMessages, exit: vi.fn() });
    expect(clearMessages).toHaveBeenCalledOnce();
    expect(result).toEqual({ type: "handled" });
  });

  it("calls exit for /exit", () => {
    const exit = vi.fn();
    const result = runSlashCommand("/exit", { clearMessages: vi.fn(), exit });
    expect(exit).toHaveBeenCalledOnce();
    expect(result).toEqual({ type: "handled" });
  });

  it("returns help result for /help", () => {
    const result = runSlashCommand("/help", {
      clearMessages: vi.fn(),
      exit: vi.fn(),
    });
    expect(result).toEqual({ type: "help" });
  });

  it("returns unknown result for unrecognized commands", () => {
    const result = runSlashCommand("/foobar", {
      clearMessages: vi.fn(),
      exit: vi.fn(),
    });
    expect(result).toEqual({ type: "unknown", name: "foobar" });
  });

  it("is case-insensitive for command names", () => {
    const clearMessages = vi.fn();
    runSlashCommand("/CLEAR", { clearMessages, exit: vi.fn() });
    expect(clearMessages).toHaveBeenCalledOnce();
  });

  it("ignores arguments after the command name", () => {
    const clearMessages = vi.fn();
    runSlashCommand("/clear extra args", { clearMessages, exit: vi.fn() });
    expect(clearMessages).toHaveBeenCalledOnce();
  });
});

describe("getSlashCommandName", () => {
  it("returns null for non-slash input", () => {
    expect(getSlashCommandName("hello")).toBeNull();
    expect(getSlashCommandName("")).toBeNull();
  });

  it("returns the command name being typed", () => {
    expect(getSlashCommandName("/cle")).toBe("cle");
    expect(getSlashCommandName("/clear")).toBe("clear");
  });

  it("returns only the command token when arguments follow", () => {
    expect(getSlashCommandName("/clear something")).toBe("clear");
  });

  it("returns empty string for a bare slash", () => {
    expect(getSlashCommandName("/")).toBe("");
  });
});

describe("matchingCommands", () => {
  it("returns all commands for empty prefix", () => {
    expect(matchingCommands("")).toHaveLength(SLASH_COMMANDS.length);
  });

  it("filters by prefix", () => {
    const results = matchingCommands("cl");
    expect(results.map((c) => c.name)).toContain("clear");
    expect(results.map((c) => c.name)).not.toContain("help");
  });

  it("is case-insensitive", () => {
    const results = matchingCommands("CL");
    expect(results.map((c) => c.name)).toContain("clear");
  });

  it("returns empty array when nothing matches", () => {
    expect(matchingCommands("zzz")).toHaveLength(0);
  });
});
