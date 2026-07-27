import { describe, expect, it, vi } from "vitest";

import {
  getSlashCommandName,
  matchingCommands,
  runSlashCommand,
  SLASH_COMMANDS,
} from "../src/pxi/commands";

describe("SLASH_COMMANDS", () => {
  it("includes session lifecycle commands", () => {
    const names = SLASH_COMMANDS.map((c) => c.name);
    expect(names).toContain("clear");
    expect(names).toContain("new");
    expect(names).toContain("sessions");
    expect(names).toContain("temporary");
    expect(names).toContain("exit");
    expect(names).toContain("help");
  });
});

describe("runSlashCommand", () => {
  function createContext() {
    return {
      startNewSession: vi.fn(),
      openSessionPicker: vi.fn(),
      exit: vi.fn(),
    };
  }

  it("starts a persisted session for /clear", () => {
    const context = createContext();
    const result = runSlashCommand("/clear", context);
    expect(context.startNewSession).toHaveBeenCalledWith({ temporary: false });
    expect(result).toEqual({ type: "handled" });
  });

  it("starts a persisted session for /new", () => {
    const context = createContext();
    runSlashCommand("/new", context);
    expect(context.startNewSession).toHaveBeenCalledWith({ temporary: false });
  });

  it("starts a temporary session for /temporary", () => {
    const context = createContext();
    runSlashCommand("/temporary", context);
    expect(context.startNewSession).toHaveBeenCalledWith({ temporary: true });
  });

  it("opens the session picker for /sessions", () => {
    const context = createContext();
    runSlashCommand("/sessions", context);
    expect(context.openSessionPicker).toHaveBeenCalledOnce();
  });

  it("calls exit for /exit", () => {
    const context = createContext();
    const result = runSlashCommand("/exit", context);
    expect(context.exit).toHaveBeenCalledOnce();
    expect(result).toEqual({ type: "handled" });
  });

  it("returns help result for /help", () => {
    const result = runSlashCommand("/help", createContext());
    expect(result).toEqual({ type: "help" });
  });

  it("returns unknown result for unrecognized commands", () => {
    const result = runSlashCommand("/foobar", createContext());
    expect(result).toEqual({ type: "unknown", name: "foobar" });
  });

  it("is case-insensitive for command names", () => {
    const context = createContext();
    runSlashCommand("/CLEAR", context);
    expect(context.startNewSession).toHaveBeenCalledOnce();
  });

  it("ignores arguments after the command name", () => {
    const context = createContext();
    runSlashCommand("/clear extra args", context);
    expect(context.startNewSession).toHaveBeenCalledOnce();
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
