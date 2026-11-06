import type { AgentUIMessage } from "@phoenix/agent/chat/types";

import {
  getPromptHistory,
  isCaretOnFirstLine,
  isCaretOnLastLine,
  stepPromptHistory,
} from "../promptHistory";

const userMessage = (id: string, text: string) =>
  ({
    id,
    role: "user",
    parts: [{ type: "text", text }],
  }) as AgentUIMessage;

const assistantMessage = (id: string, text: string) =>
  ({
    id,
    role: "assistant",
    parts: [{ type: "text", text }],
  }) as AgentUIMessage;

const compactionMessage = (id: string, summary: string) =>
  ({
    id,
    role: "user",
    metadata: {
      phoenix: {
        type: "user",
        currentDateTime: "2026-01-01T00:00:00Z",
        timeZone: "UTC",
        isCompactionMessage: true,
      },
    },
    parts: [{ type: "text", text: summary }],
  }) as AgentUIMessage;

describe("getPromptHistory", () => {
  it("returns user message text newest first", () => {
    expect(
      getPromptHistory([
        userMessage("u1", "first"),
        assistantMessage("a1", "reply"),
        userMessage("u2", "second"),
      ])
    ).toEqual(["second", "first"]);
  });

  it("skips compaction messages and empty text", () => {
    expect(
      getPromptHistory([
        userMessage("u1", "first"),
        compactionMessage("c1", "summary"),
        userMessage("u2", "   "),
      ])
    ).toEqual(["first"]);
  });

  it("collapses consecutive repeats", () => {
    expect(
      getPromptHistory([
        userMessage("u1", "again"),
        userMessage("u2", "again"),
        userMessage("u3", "other"),
        userMessage("u4", "again"),
      ])
    ).toEqual(["again", "other", "again"]);
  });
});

describe("stepPromptHistory", () => {
  const history = ["newest", "middle", "oldest"];

  it("stops cycling once the recalled entry is edited", () => {
    expect(
      stepPromptHistory({
        history,
        index: 0,
        value: "newest edited",
        direction: "older",
      })
    ).toBeNull();
    expect(
      stepPromptHistory({
        history,
        index: 0,
        value: "newest edited",
        direction: "newer",
      })
    ).toBeNull();
  });

  it("does nothing for down arrow when not cycling", () => {
    expect(
      stepPromptHistory({ history, index: null, value: "", direction: "newer" })
    ).toBeNull();
  });
});

describe("caret line checks", () => {
  const value = "line one\nline two";

  it("detects the first line", () => {
    expect(isCaretOnFirstLine(value, 3, 3)).toBe(true);
    expect(isCaretOnFirstLine(value, 12, 12)).toBe(false);
  });

  it("detects the last line", () => {
    expect(isCaretOnLastLine(value, 12, 12)).toBe(true);
    expect(isCaretOnLastLine(value, 3, 3)).toBe(false);
  });

  it("treats a selection as neither", () => {
    expect(isCaretOnFirstLine(value, 0, 3)).toBe(false);
    expect(isCaretOnLastLine(value, 12, 15)).toBe(false);
  });
});
