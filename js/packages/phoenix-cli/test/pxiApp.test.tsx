import { render } from "ink-testing-library";
import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { PxiApp, ThinkingIndicator } from "../src/pxi/App";
import { resolvePxiRuntimeOptions } from "../src/pxi/options";
import type {
  ModelSelection,
  PxiChatClient,
  PxiMessage,
  PxiRuntimeOptions,
  PxiSessionClient,
  PxiSessionSummary,
} from "../src/pxi/types";

const ESCAPE_CHARACTER = String.fromCharCode(27);
const ANSI_ESCAPE_PATTERN = new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, "g");
const KITTY_SHIFT_ENTER = `${ESCAPE_CHARACTER}[13;2u`;
const KITTY_PROTOCOL_RESPONSE = `${ESCAPE_CHARACTER}[?0u`;
const BRACKETED_PASTE_START = `${ESCAPE_CHARACTER}[200~`;
const BRACKETED_PASTE_END = `${ESCAPE_CHARACTER}[201~`;
const UP_ARROW = `${ESCAPE_CHARACTER}[A`;
const DOWN_ARROW = `${ESCAPE_CHARACTER}[B`;
const LEFT_ARROW = `${ESCAPE_CHARACTER}[D`;
const RIGHT_ARROW = `${ESCAPE_CHARACTER}[C`;
const HOME_KEY = `${ESCAPE_CHARACTER}[H`;
const END_KEY = `${ESCAPE_CHARACTER}[F`;
const DELETE_KEY = `${ESCAPE_CHARACTER}[3~`;
const MODIFIED_DELETE_KEY = `${ESCAPE_CHARACTER}[3$`;
const KITTY_MAC_DELETE = `${ESCAPE_CHARACTER}[127;1:1u`;
const KITTY_FORWARD_DELETE_KEY = `${ESCAPE_CHARACTER}[3;1:1~`;
const CTRL_A = "\x01";
const CTRL_E = "\x05";
const BACKSPACE = "\b";
const MAC_DELETE = "\x7F";

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, "");
}

function createOptions({
  endpoint = "http://localhost:6006",
  explicitModel = true,
}: {
  endpoint?: string;
  /**
   * Whether `--provider`/`--model` were passed. Explicit flags make restoring
   * a session *write* that model, so tests covering the adopt-the-persisted-
   * model path must opt out.
   */
  explicitModel?: boolean;
} = {}) {
  return resolvePxiRuntimeOptions({
    cliOptions: {
      endpoint,
      ...(explicitModel ? { provider: "OPENAI", model: "gpt-5.4" } : {}),
    },
    sessionId: "session-1",
  });
}

function createCapturingClient({
  onSubmit,
}: {
  onSubmit: (text: string | undefined) => void;
}): PxiChatClient {
  return {
    sendMessage: async ({ messages }) => {
      const userMessage = messages.at(-1);
      const textPart = userMessage?.parts.find((part) => part.type === "text");
      onSubmit(textPart?.text);
      return null;
    },
  };
}

async function writeInput({
  stdin,
  input,
}: {
  stdin: { write: (input: string) => unknown };
  input: string;
}) {
  await act(async () => {
    stdin.write(input);
  });
}

/**
 * ink v7 buffers a lone Esc and unrecognized escape-sequence prefixes for
 * 20ms before flushing them as literal input; wait past that window so the
 * input reaches the app's handlers before asserting.
 */
async function flushPendingEscapeInput() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

async function writeInputRepeatedly({
  stdin,
  input,
  count,
}: {
  stdin: { write: (input: string) => unknown };
  input: string;
  count: number;
}) {
  for (let index = 0; index < count; index++) {
    await writeInput({ stdin, input });
  }
}

describe("PXI app", () => {
  it("renders the initial terminal UI", () => {
    const client: PxiChatClient = {
      sendMessage: async () => null,
    };
    const { lastFrame, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    expect(lastFrame()).toContain("Phoenix Intelligence.");
    expect(lastFrame()).toContain("endpoint: http://localhost:6006");
    expect(lastFrame()).toContain("model: OPENAI/gpt-5.4");
    expect(lastFrame()).toContain("↵ send");
    expect(lastFrame()).toContain("⇧↵ newline");
    unmount();
  });

  it("shows the active model name in the prompt footer", () => {
    const client: PxiChatClient = {
      sendMessage: async () => null,
    };
    const { lastFrame, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    // The model name is pinned to the bottom-right of the prompt, below the
    // help text rather than in the header status line.
    const frame = stripAnsi(lastFrame() ?? "");
    const footer = frame.slice(frame.indexOf("↵ send"));
    expect(footer).toContain("gpt-5.4");
    expect(footer).not.toContain("OPENAI/gpt-5.4");
    unmount();
  });

  it("uses Shift+Enter to insert a newline at the cursor before submitting", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "first linesecond line" });
    await writeInputRepeatedly({ stdin, input: LEFT_ARROW, count: 11 });
    await writeInput({ stdin, input: KITTY_SHIFT_ENTER });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("first line\nsecond line");
    unmount();
  });

  it("uses Left and Right arrows to insert typed text at the cursor", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "helo" });
    await writeInput({ stdin, input: LEFT_ARROW });
    await writeInput({ stdin, input: "l" });
    await writeInput({ stdin, input: RIGHT_ARROW });
    await writeInput({ stdin, input: "!" });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("hello!");
    unmount();
  });

  it("renders the cursor over the selected character without shifting draft text", async () => {
    const client: PxiChatClient = {
      sendMessage: async () => null,
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "hello" });
    await writeInputRepeatedly({ stdin, input: LEFT_ARROW, count: 2 });

    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("█");
    expect(stripAnsi(frame)).toContain("❯ hello");
    unmount();
  });

  it("renders the cursor on an empty prompt line", async () => {
    const client: PxiChatClient = {
      sendMessage: async () => null,
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "top" });
    await writeInput({ stdin, input: KITTY_SHIFT_ENTER });
    await writeInput({ stdin, input: KITTY_SHIFT_ENTER });
    await writeInput({ stdin, input: "bottom" });
    await writeInput({ stdin, input: UP_ARROW });

    const frame = lastFrame() ?? "";
    expect(stripAnsi(frame)).toMatch(/❯ top\n\s*█\n\s*bottom/);
    unmount();
  });

  it("uses Up arrow to move to the previous prompt line", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "hello" });
    await writeInput({ stdin, input: KITTY_SHIFT_ENTER });
    await writeInput({ stdin, input: "world" });
    await writeInput({ stdin, input: UP_ARROW });
    await writeInput({ stdin, input: "!" });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("hello!\nworld");
    unmount();
  });

  it("uses Down arrow to move to the next prompt line", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "hello" });
    await writeInput({ stdin, input: KITTY_SHIFT_ENTER });
    await writeInput({ stdin, input: "world" });
    await writeInput({ stdin, input: CTRL_A });
    await writeInput({ stdin, input: DOWN_ARROW });
    await writeInput({ stdin, input: "!" });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("hello\n!world");
    unmount();
  });

  it("uses Down arrow from a blank first prompt line", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: KITTY_SHIFT_ENTER });
    await writeInput({ stdin, input: "world" });
    await writeInput({ stdin, input: CTRL_A });
    await writeInput({ stdin, input: DOWN_ARROW });
    await writeInput({ stdin, input: "!" });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("!world");
    unmount();
  });

  it("preserves the preferred cursor column across vertical cursor movement", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "abcd" });
    await writeInput({ stdin, input: KITTY_SHIFT_ENTER });
    await writeInput({ stdin, input: "ef" });
    await writeInput({ stdin, input: KITTY_SHIFT_ENTER });
    await writeInput({ stdin, input: "ghij" });
    await writeInput({ stdin, input: UP_ARROW });
    await writeInput({ stdin, input: UP_ARROW });
    await writeInput({ stdin, input: "!" });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("abcd!\nef\nghij");
    unmount();
  });

  it("uses Backspace before the cursor", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "abXYcd" });
    await writeInputRepeatedly({ stdin, input: LEFT_ARROW, count: 3 });
    await writeInput({ stdin, input: BACKSPACE });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("abYcd");
    unmount();
  });

  it.each([
    ["Mac Delete", MAC_DELETE],
    ["Kitty-enhanced Mac Delete", KITTY_MAC_DELETE],
  ])("uses %s before the cursor", async (_name, deleteInput) => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "abXcd" });
    await writeInputRepeatedly({ stdin, input: LEFT_ARROW, count: 2 });
    await writeInput({ stdin, input: deleteInput });
    await flushPendingEscapeInput();
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("abcd");
    unmount();
  });

  it("uses Mac Delete before the cursor at the end of the prompt", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "abc" });
    await writeInput({ stdin, input: MAC_DELETE });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("ab");
    unmount();
  });

  it("uses forward Delete after the cursor", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "abXcd" });
    await writeInputRepeatedly({ stdin, input: LEFT_ARROW, count: 3 });
    await writeInput({ stdin, input: DELETE_KEY });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("abcd");
    unmount();
  });

  it.each([
    ["modified terminal forward Delete", MODIFIED_DELETE_KEY],
    ["Kitty-enhanced forward Delete", KITTY_FORWARD_DELETE_KEY],
  ])("uses %s after the cursor", async (_name, deleteInput) => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "abXcd" });
    await writeInputRepeatedly({ stdin, input: LEFT_ARROW, count: 3 });
    await writeInput({ stdin, input: deleteInput });
    await flushPendingEscapeInput();
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("abcd");
    unmount();
  });

  it("leaves the prompt unchanged when forward Delete is pressed at the end", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "abc" });
    await writeInput({ stdin, input: DELETE_KEY });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("abc");
    unmount();
  });

  it("uses Home and End to move the cursor", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "middle" });
    await writeInput({ stdin, input: HOME_KEY });
    await writeInput({ stdin, input: "start-" });
    await writeInput({ stdin, input: END_KEY });
    await writeInput({ stdin, input: "-end" });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("start-middle-end");
    unmount();
  });

  it("uses Ctrl+A and Ctrl+E to move the cursor", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "middle" });
    await writeInput({ stdin, input: CTRL_A });
    await writeInput({ stdin, input: "start-" });
    await writeInput({ stdin, input: CTRL_E });
    await writeInput({ stdin, input: "-end" });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("start-middle-end");
    unmount();
  });

  it("inserts pasted text at the cursor", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "hello world" });
    await writeInput({ stdin, input: HOME_KEY });
    await writeInput({ stdin, input: "say " });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe("say hello world");
    unmount();
  });

  it("normalizes multiline pasted text before inserting it into the prompt", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );
    const prompt = [
      "Summarize the trace behavior below.",
      "",
      "First, identify the main failure mode.",
      "",
      "Then list the affected spans:",
      "",
      "- root span",
      "- retrieval span",
      "- generation span",
      "",
      "Now explain why the middle blank line matters:",
      "",
      "",
      "After that, propose a fix.",
      "",
      "Finally, give me a concise next step.",
    ].join("\n");

    await writeInput({ stdin, input: prompt.replace(/\n/g, "\r\n") });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe(prompt);
    unmount();
  });

  it("renders multiline pasted text without carriage-return compression", async () => {
    const client: PxiChatClient = {
      sendMessage: async () => null,
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({
      stdin,
      input: [
        "Now explain why the middle blank line matters:",
        "",
        "",
        "After that, propose a fix.",
        "",
        "Finally, give me a concise next step.",
      ].join("\r\n"),
    });

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).not.toContain("\r");
    expect(frame).toMatch(
      /Now explain why the middle blank line matters:\n\s*\n\s*\n\s*After that, propose a fix\.\n\s*\n\s*Finally, give me a concise next step\.█/
    );
    unmount();
  });

  it("uses Mac Delete predictably after multiline pasted text", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );
    const prompt = [
      "Now explain why the middle blank line matters:",
      "",
      "",
      "After that, propose a fix.",
      "",
      "Finally, give me a concise next step.",
    ].join("\n");
    const deletedText = "\nFinally, give me a concise next step.";

    await writeInput({ stdin, input: prompt.replace(/\n/g, "\r\n") });
    await writeInputRepeatedly({
      stdin,
      input: MAC_DELETE,
      count: deletedText.length,
    });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe(prompt.slice(0, -deletedText.length).trim());
    unmount();
  });

  it("ignores bracketed paste markers around multiline pasted text", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );
    const prompt = "top\n\nbottom";

    await writeInput({
      stdin,
      input: `${BRACKETED_PASTE_START}${prompt}${BRACKETED_PASTE_END}`,
    });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe(prompt);
    unmount();
  });

  it("preserves literal bracketed paste marker text", async () => {
    let submittedText: string | undefined;
    const client = createCapturingClient({
      onSubmit: (text) => {
        submittedText = text;
      },
    });
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );
    const prompt = "literal [200~ marker [201~ text";

    await writeInput({ stdin, input: prompt });
    await writeInput({ stdin, input: "\r" });

    expect(submittedText).toBe(prompt);
    unmount();
  });

  it("ignores terminal keyboard protocol responses", async () => {
    const client: PxiChatClient = {
      sendMessage: async () => null,
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await act(async () => {
      stdin.write(KITTY_PROTOCOL_RESPONSE);
    });

    expect(lastFrame()).not.toContain("[?0u");
    unmount();
  });

  it("aborts an in-flight request on Ctrl+C", async () => {
    let abortSignal: AbortSignal | undefined;
    const client: PxiChatClient = {
      sendMessage: async ({ abortSignal: signal }) => {
        abortSignal = signal;
        return new Promise((resolve) => {
          signal?.addEventListener("abort", () => resolve(null), {
            once: true,
          });
        });
      },
    };
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await act(async () => {
      stdin.write("hello");
    });
    await act(async () => {
      stdin.write("\r");
    });
    await act(async () => {
      stdin.write("\x03");
    });

    expect(abortSignal?.aborted).toBe(true);
    unmount();
  });

  it("ignores prompt editing while streaming", async () => {
    const submittedTexts: string[] = [];
    let resolveResponse: ((message: PxiMessage | null) => void) | undefined;
    const client: PxiChatClient = {
      sendMessage: async ({ messages }) => {
        const userMessage = messages.at(-1);
        const textPart = userMessage?.parts.find(
          (part) => part.type === "text"
        );
        submittedTexts.push(textPart?.text ?? "");
        if (submittedTexts.length === 1) {
          return new Promise((resolve) => {
            resolveResponse = resolve;
          });
        }
        return null;
      },
    };
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "hello" });
    await writeInput({ stdin, input: "\r" });
    await writeInput({ stdin, input: "ignored" });
    await writeInput({ stdin, input: MAC_DELETE });
    await writeInput({ stdin, input: DELETE_KEY });
    await writeInput({ stdin, input: BRACKETED_PASTE_START });
    await writeInput({ stdin, input: BRACKETED_PASTE_END });
    await writeInput({ stdin, input: "\r" });

    expect(submittedTexts).toEqual(["hello"]);

    await act(async () => {
      resolveResponse?.(null);
    });
    await writeInput({ stdin, input: "next [200~ [201~" });
    await writeInput({ stdin, input: "\r" });

    expect(submittedTexts).toEqual(["hello", "next [200~ [201~"]);
    unmount();
  });

  it("interrupts an in-flight request on Esc and sends the partial transcript next", async () => {
    const submittedMessages: PxiMessage[][] = [];
    const abortSignals: AbortSignal[] = [];
    const partialAssistantMessage: PxiMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        { type: "text", text: "Partial answer", state: "streaming" },
        {
          type: "dynamic-tool",
          toolCallId: "tool-1",
          toolName: "phoenix_graphql",
          state: "input-streaming",
          input: { query: "{ projects" },
        },
      ],
    };
    const client: PxiChatClient = {
      sendMessage: async ({ messages, abortSignal, onAssistantMessage }) => {
        submittedMessages.push(messages);
        if (abortSignal) {
          abortSignals.push(abortSignal);
        }
        if (submittedMessages.length === 1) {
          onAssistantMessage(partialAssistantMessage);
          return new Promise((resolve) => {
            abortSignal?.addEventListener("abort", () => resolve(null), {
              once: true,
            });
          });
        }
        return null;
      },
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await act(async () => {
      stdin.write("hello");
    });
    await act(async () => {
      stdin.write("\r");
    });

    expect(lastFrame()).toContain("Partial answer");

    await act(async () => {
      stdin.write(ESCAPE_CHARACTER);
    });
    await flushPendingEscapeInput();

    expect(abortSignals[0]?.aborted).toBe(true);
    expect(lastFrame()).toContain("Interrupted by user before completion.");
    expect(lastFrame()).not.toContain("PXI is thinking");

    await act(async () => {
      stdin.write("continue");
    });
    await act(async () => {
      stdin.write("\r");
    });

    expect(submittedMessages).toHaveLength(2);
    const assistantMessage = submittedMessages[1]?.find(
      (message) => message.role === "assistant"
    );
    expect(assistantMessage?.parts).toEqual([
      { type: "text", text: "Partial answer", state: "done" },
      {
        type: "text",
        text: "\n\n[Interrupted by user before completion.]",
        state: "done",
      },
    ]);
    unmount();
  });

  it("renders tool progress without hiding transcript text", () => {
    const assistantMessage: PxiMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        { type: "text", text: "I checked the project.", state: "done" },
        {
          type: "dynamic-tool",
          toolCallId: "tool-1",
          toolName: "phoenix_graphql",
          state: "output-available",
          input: { query: "{ projects { id } }" },
          output: { data: { projects: [{ id: "1" }] }, errors: [] },
        },
        { type: "text", text: "Then I summarized it.", state: "done" },
      ],
    };
    const { lastFrame, unmount } = render(
      <PxiApp options={createOptions()} initialMessages={[assistantMessage]} />
    );

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("I checked the project.");
    expect(frame).toContain("✓ ◆ phoenix_graphql · { projects { id } }");
    expect(frame).not.toContain("result object (2 keys: data, errors)");
    expect(frame).toContain("Then I summarized it.");
    expect(frame.indexOf("I checked the project.")).toBeLessThan(
      frame.indexOf("phoenix_graphql")
    );
    expect(frame.indexOf("phoenix_graphql")).toBeLessThan(
      frame.indexOf("Then I summarized it.")
    );
    expect(frame).not.toContain('{"data"');
    expect(frame).not.toContain("╭");
    unmount();
  });

  it("shows a bash summary and a spinner while its input streams in", async () => {
    const partialAssistantMessage: PxiMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "tool-1",
          toolName: "bash",
          state: "input-streaming",
          input: { summary: "Run the unit test suite" },
        },
      ],
    };
    const client: PxiChatClient = {
      sendMessage: async ({ abortSignal, onAssistantMessage }) => {
        onAssistantMessage(partialAssistantMessage);
        // Keep the turn streaming so the pending tool stays live.
        return new Promise((resolve) => {
          abortSignal?.addEventListener("abort", () => resolve(null), {
            once: true,
          });
        });
      },
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "run the tests" });
    await writeInput({ stdin, input: "\r" });

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("$ bash · Run the unit test suite");
    expect(frame).toContain("⠋");
    expect(frame).not.toContain("✓");
    unmount();
  });

  it("marks a restored pending tool as pending elsewhere instead of running", () => {
    // A pending tool restored from persistence isn't running in this CLI:
    // the client that owns it (e.g. a browser approval) may still submit its
    // result, and sending a message from here interrupts it. Either way the
    // spinner would misrepresent it as work this CLI is watching.
    const assistantMessage: PxiMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "tool-1",
          toolName: "bash",
          state: "input-streaming",
          input: { summary: "Run the unit test suite" },
        },
      ],
    };
    const { lastFrame, unmount } = render(
      <PxiApp options={createOptions()} initialMessages={[assistantMessage]} />
    );

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain(
      "$ bash Pending in another client — sending a message here interrupts it"
    );
    expect(frame).toContain("⚠");
    expect(frame).not.toContain("⠋");
    expect(frame).not.toContain("✓");
    unmount();
  });

  it("renders bash command lines and failure output after completion", () => {
    const assistantMessage: PxiMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "tool-1",
          toolName: "bash",
          state: "output-available",
          input: {
            summary: "Install a dependency",
            command: "pnpm add left-pad\necho done",
          },
          output: {
            stdout: "",
            stderr: "ERR_PNPM_ADDING_TO_ROOT",
            exit_code: 1,
          },
        },
      ],
    };
    const { lastFrame, unmount } = render(
      <PxiApp options={createOptions()} initialMessages={[assistantMessage]} />
    );

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("✗ $ bash · Install a dependency (exit 1)");
    expect(frame).toContain("pnpm add left-pad");
    expect(frame).toContain("echo done");
    expect(frame).toContain("ERR_PNPM_ADDING_TO_ROOT");
    unmount();
  });

  it("collapses a completed load_skill call to a quiet line", () => {
    const assistantMessage: PxiMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolCallId: "tool-1",
          toolName: "load_skill",
          state: "output-available",
          input: { skill_name: "datasets" },
          output: { content: "skill body" },
        },
      ],
    };
    const { lastFrame, unmount } = render(
      <PxiApp options={createOptions()} initialMessages={[assistantMessage]} />
    );

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("✓ Loaded skill datasets");
    expect(frame).not.toContain("load_skill");
    expect(frame).not.toContain("skill body");
    unmount();
  });

  it("animates the thinking indicator while streaming", async () => {
    vi.useFakeTimers();
    const { lastFrame, unmount } = render(<ThinkingIndicator />);

    try {
      expect(lastFrame()).toContain("PXI is thinking");
      const firstFrame = lastFrame();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(lastFrame()).toContain("PXI is thinking");
      expect(lastFrame()).not.toBe(firstFrame);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("renders assistant markdown tables as terminal tables", () => {
    const assistantMessage: PxiMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: [
            "Projects:",
            "",
            "| Name | Traces |",
            "| --- | ---: |",
            "| default | 12 |",
          ].join("\n"),
          state: "done",
        },
      ],
    };
    const { lastFrame, unmount } = render(
      <PxiApp options={createOptions()} initialMessages={[assistantMessage]} />
    );

    const strippedFrame = stripAnsi(lastFrame() ?? "");

    expect(strippedFrame).toContain("Projects:");
    expect(strippedFrame).toContain("┌");
    expect(strippedFrame).toContain("│ Name");
    expect(strippedFrame).not.toContain("| --- |");
    unmount();
  });

  it("shows command completions while typing a slash command name", async () => {
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await act(async () => {
      stdin.write("/cl");
    });

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("/clear");
    expect(frame).toContain("Start a new persisted session");
    unmount();
  });

  it("completes the suggested slash command with Tab", async () => {
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "/cl" });
    await writeInput({ stdin, input: "\t" });

    expect(stripAnsi(lastFrame() ?? "")).toContain("❯ /clear█");
    unmount();
  });

  it("hides completions once the user types a space after the command name", async () => {
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await act(async () => {
      stdin.write("/clear ");
    });

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("↵ send");
    unmount();
  });

  it("/clear resets the conversation history", async () => {
    const client: PxiChatClient = { sendMessage: async () => null };
    const initialMessages: PxiMessage[] = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "hi there", state: "done" }],
      },
    ];
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        initialMessages={initialMessages}
      />
    );

    expect(lastFrame()).toContain("hi there");

    await act(async () => {
      stdin.write("/clear");
    });
    await act(async () => {
      stdin.write("\r");
    });

    expect(stripAnsi(lastFrame() ?? "")).toContain("Phoenix Intelligence.");
    expect(lastFrame()).not.toContain("hi there");
    unmount();
  });

  it("/help prints the command list in the transcript", async () => {
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await act(async () => {
      stdin.write("/help");
    });
    await act(async () => {
      stdin.write("\r");
    });

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("/clear");
    expect(frame).toContain("/help");
    expect(frame).toContain("/exit");
    unmount();
  });

  it("creates a temporary server session on the first message after /temporary", async () => {
    const createSession = vi.fn(
      async ({ temporary }: { temporary: boolean }) => ({
        id: "temporary-session",
        title: "",
        updatedAt: "2026-07-24T12:00:00Z",
        isTemporary: temporary,
        messages: [],
      })
    );
    const sessionClient: PxiSessionClient = {
      createSession,
      listSessions: async () => [],
      getSession: async () => {
        throw new Error("not used");
      },
      getSessionSyncState: async () => {
        throw new Error("not used");
      },
      patchSessionModel: async ({ model }) => model,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        sessionClient={sessionClient}
      />
    );

    await writeInput({ stdin, input: "/temporary" });
    await writeInput({ stdin, input: "\r" });
    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "session: new temporary session"
    );
    await writeInput({ stdin, input: "hello" });
    await writeInput({ stdin, input: "\r" });

    expect(createSession).toHaveBeenCalledWith({
      temporary: true,
      model: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-5.4",
      },
    });
    unmount();
  });

  it("updates a new session title from the streamed session summary", async () => {
    const sessionClient: PxiSessionClient = {
      createSession: async () => ({
        id: "session-1",
        title: "",
        updatedAt: "2026-07-24T12:00:00Z",
        isTemporary: false,
        messages: [],
      }),
      listSessions: async () => [],
      getSession: async () => {
        throw new Error("not used");
      },
      getSessionSyncState: async () => {
        throw new Error("not used");
      },
      patchSessionModel: async ({ model }) => model,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const client: PxiChatClient = {
      sendMessage: async ({ onSessionTitle }) => {
        onSessionTitle?.("Investigate missing spans");
        return null;
      },
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        sessionClient={sessionClient}
      />
    );

    await writeInput({ stdin, input: "why are spans missing?" });
    await writeInput({ stdin, input: "\r" });

    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "session: Investigate missing spans"
    );
    unmount();
  });

  it("browses and restores a persisted session", async () => {
    const restoredUserMessage: PxiMessage = {
      id: "restored-user",
      role: "user",
      parts: [{ type: "text", text: "restored conversation" }],
    };
    const restoredInterruptedMessage: PxiMessage = {
      id: "restored-assistant",
      role: "assistant",
      parts: [{ type: "text", text: "partial response", state: "done" }],
      metadata: {
        phoenix: {
          type: "assistant",
          sessionId: "session-2",
          interrupted: true,
        },
      },
    };
    const getSession = vi.fn(async ({ sessionId }: { sessionId: string }) => ({
      id: sessionId,
      title: "Second session",
      updatedAt: "2026-07-24T12:00:00Z",
      isTemporary: false,
      messages: [restoredUserMessage, restoredInterruptedMessage],
      // Differs from the --provider/--model flags so restoring writes the
      // flag model instead of resolving against the server catalog.
      model: {
        providerType: "builtin",
        provider: "GOOGLE",
        modelName: "gemini-3.5-flash",
      } satisfies ModelSelection,
    }));
    const sessionClient: PxiSessionClient = {
      createSession: async () => {
        throw new Error("not used");
      },
      listSessions: async () => [
        {
          id: "session-1",
          title: "First session",
          updatedAt: "2026-07-24T13:00:00Z",
          isTemporary: false,
        },
        {
          id: "session-2",
          title: "Second session",
          updatedAt: "2026-07-24T12:00:00Z",
          isTemporary: false,
        },
      ],
      getSession,
      getSessionSyncState: async () => {
        throw new Error("not used");
      },
      patchSessionModel: async ({ model }) => model,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        sessionClient={sessionClient}
      />
    );

    await writeInput({ stdin, input: "/sessions" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    expect(stripAnsi(lastFrame() ?? "")).toContain("Recent sessions");
    expect(stripAnsi(lastFrame() ?? "")).toContain("First session");

    await writeInput({ stdin, input: DOWN_ARROW });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());

    expect(getSession).toHaveBeenCalledWith({ sessionId: "session-2" });
    const restoredFrame = stripAnsi(lastFrame() ?? "");
    expect(restoredFrame).toContain("restored conversation");
    expect(restoredFrame).toContain("partial response");
    expect(restoredFrame).toContain("── Response interrupted ──");
    expect(restoredFrame).toContain("session: Second session");
    unmount();
  });

  it("navigates beyond the first 20 persisted sessions", async () => {
    const sessions: PxiSessionSummary[] = Array.from(
      { length: 21 },
      (_, index) => ({
        id: `session-${index + 1}`,
        title: `Session ${index + 1}`,
        updatedAt: "2026-07-24T12:00:00Z",
        isTemporary: false,
      })
    );
    const getSession = vi.fn(async ({ sessionId }: { sessionId: string }) => ({
      id: sessionId,
      title: "Session 21",
      updatedAt: "2026-07-24T12:00:00Z",
      isTemporary: false,
      messages: [
        {
          id: "restored-user",
          role: "user" as const,
          parts: [{ type: "text" as const, text: "oldest conversation" }],
        },
      ],
      // Differs from the --provider/--model flags so restoring writes the
      // flag model instead of resolving against the server catalog.
      model: {
        providerType: "builtin",
        provider: "GOOGLE",
        modelName: "gemini-3.5-flash",
      } satisfies ModelSelection,
    }));
    const sessionClient: PxiSessionClient = {
      createSession: async () => {
        throw new Error("not used");
      },
      listSessions: async () => sessions,
      getSession,
      getSessionSyncState: async () => {
        throw new Error("not used");
      },
      patchSessionModel: async ({ model }) => model,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        sessionClient={sessionClient}
      />
    );

    await writeInput({ stdin, input: "/sessions" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    for (let sessionIndex = 1; sessionIndex < sessions.length; sessionIndex++) {
      await writeInput({ stdin, input: DOWN_ARROW });
    }
    expect(stripAnsi(lastFrame() ?? "")).toContain("Session 21");

    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());

    expect(getSession).toHaveBeenCalledWith({ sessionId: "session-21" });
    expect(stripAnsi(lastFrame() ?? "")).toContain("oldest conversation");
    unmount();
  });

  it("polls idle sessions for remote updates and pauses during local generation", async () => {
    vi.useFakeTimers();
    const originalMessage: PxiMessage = {
      id: "original-message",
      role: "user",
      parts: [{ type: "text", text: "original conversation" }],
    };
    const synchronizedMessage: PxiMessage = {
      id: "synchronized-message",
      role: "assistant",
      parts: [{ type: "text", text: "updated by another client" }],
    };
    let getSessionCallCount = 0;
    const getSession = vi.fn(async ({ sessionId }: { sessionId: string }) => {
      getSessionCallCount += 1;
      const isSynchronized = getSessionCallCount >= 2;
      return {
        id: sessionId,
        title: "Shared session",
        updatedAt: isSynchronized
          ? "2026-07-24T12:05:00Z"
          : "2026-07-24T12:00:00Z",
        isTemporary: false,
        isActive: false,
        lastMessageId: isSynchronized
          ? synchronizedMessage.id
          : originalMessage.id,
        messages: isSynchronized ? [synchronizedMessage] : [originalMessage],
        model: {
          providerType: "builtin",
          provider: "OPENAI",
          modelName: "gpt-5.4",
        } satisfies ModelSelection,
      };
    });
    let syncStateCallCount = 0;
    const getSessionSyncState = vi.fn(async () => {
      syncStateCallCount += 1;
      // Probe 1: another client's turn holds the lock. Probes 2+: the turn
      // completed and the transcript's tail moved once, then stays put.
      const isSynchronized = syncStateCallCount >= 2;
      return {
        isActive: syncStateCallCount === 1,
        updatedAt: isSynchronized
          ? "2026-07-24T12:05:00Z"
          : "2026-07-24T12:00:00Z",
        lastMessageId: isSynchronized
          ? synchronizedMessage.id
          : originalMessage.id,
      };
    });
    const sessionClient: PxiSessionClient = {
      createSession: async () => {
        throw new Error("not used");
      },
      listSessions: async () => [
        {
          id: "session-1",
          title: "Shared session",
          updatedAt: "2026-07-24T12:00:00Z",
          isTemporary: false,
        },
      ],
      getSession,
      getSessionSyncState,
      patchSessionModel: async ({ model }) => model,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const client: PxiChatClient = {
      sendMessage: async () => new Promise(() => {}),
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        sessionClient={sessionClient}
        // The persisted model equals the flags, so restoring skips the write
        // and resolves the persisted model instead.
        sessionModelResolver={async (model: ModelSelection) => model}
      />
    );

    try {
      await writeInput({ stdin, input: "/sessions" });
      await writeInput({ stdin, input: "\r" });
      await act(async () => Promise.resolve());
      await writeInput({ stdin, input: "\r" });
      await act(async () => Promise.resolve());

      expect(getSession).toHaveBeenCalledTimes(1);
      expect(stripAnsi(lastFrame() ?? "")).toContain("original conversation");

      // Probe 1: another client holds the lock. The cheap probe alone drives
      // the busy state; the full transcript is not refetched.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(getSessionSyncState).toHaveBeenCalledTimes(1);
      expect(getSession).toHaveBeenCalledTimes(1);
      expect(stripAnsi(lastFrame() ?? "")).toContain(
        "Session is being used elsewhere"
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_999);
      });
      expect(getSessionSyncState).toHaveBeenCalledTimes(1);

      // Probe 2 (fast cadence): the turn completed and the tail moved, so the
      // full transcript is fetched and swapped in.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(getSessionSyncState).toHaveBeenCalledTimes(2);
      expect(getSession).toHaveBeenCalledTimes(2);
      expect(stripAnsi(lastFrame() ?? "")).toContain(
        "updated by another client"
      );

      // Probe 3 (slow cadence): the tail has not moved since the last full
      // fetch, so the transcript download is skipped.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(getSessionSyncState).toHaveBeenCalledTimes(3);
      expect(getSession).toHaveBeenCalledTimes(2);

      // Local generation pauses polling entirely.
      await writeInput({ stdin, input: "local question" });
      await writeInput({ stdin, input: "\r" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(getSessionSyncState).toHaveBeenCalledTimes(3);
      expect(getSession).toHaveBeenCalledTimes(2);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("adopts the persisted model when restoring a session", async () => {
    const persistedModel: ModelSelection = {
      providerType: "builtin",
      provider: "GOOGLE",
      modelName: "gemini-3.5-flash",
    };
    const sessionModelResolver = vi.fn(async (model: ModelSelection) => model);
    const sessionClient: PxiSessionClient = {
      createSession: async () => {
        throw new Error("not used");
      },
      listSessions: async () => [
        {
          id: "session-1",
          title: "Persisted session",
          updatedAt: "2026-07-24T13:00:00Z",
          isTemporary: false,
        },
      ],
      getSession: async ({ sessionId }) => ({
        id: sessionId,
        title: "Persisted session",
        updatedAt: "2026-07-24T13:00:00Z",
        isTemporary: false,
        isActive: false,
        messages: [],
        model: persistedModel,
      }),
      patchSessionModel: async ({ model }) => model,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions({ explicitModel: false })}
        client={{ sendMessage: async () => null }}
        sessionClient={sessionClient}
        sessionModelResolver={sessionModelResolver}
      />
    );

    await writeInput({ stdin, input: "/sessions" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());

    expect(sessionModelResolver).toHaveBeenCalledWith(persistedModel);
    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "model: GOOGLE/gemini-3.5-flash"
    );
    unmount();
  });

  it("moves a restored session onto the model named by --provider/--model", async () => {
    const persistedModel: ModelSelection = {
      providerType: "builtin",
      provider: "GOOGLE",
      modelName: "gemini-3.5-flash",
    };
    const sessionModelResolver = vi.fn(async (model: ModelSelection) => model);
    const patchSessionModel = vi.fn(
      async ({ model }: { sessionId: string; model: ModelSelection }) => model
    );
    const sessionClient: PxiSessionClient = {
      createSession: async () => {
        throw new Error("not used");
      },
      listSessions: async () => [
        {
          id: "session-1",
          title: "Persisted session",
          updatedAt: "2026-07-24T13:00:00Z",
          isTemporary: false,
        },
      ],
      getSession: async ({ sessionId }) => ({
        id: sessionId,
        title: "Persisted session",
        updatedAt: "2026-07-24T13:00:00Z",
        isTemporary: false,
        isActive: false,
        messages: [],
        model: persistedModel,
      }),
      patchSessionModel,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={{ sendMessage: async () => null }}
        sessionClient={sessionClient}
        sessionModelResolver={sessionModelResolver}
      />
    );

    await writeInput({ stdin, input: "/sessions" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());

    // The flag is applied as a write, not shadowed locally, so the session
    // itself moves and every other client sees the change.
    expect(patchSessionModel).toHaveBeenCalledWith({
      sessionId: "session-1",
      model: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-5.4",
      },
    });
    expect(sessionModelResolver).not.toHaveBeenCalled();
    expect(stripAnsi(lastFrame() ?? "")).toContain("model: OPENAI/gpt-5.4");
    unmount();
  });

  it("skips the model write when the restored session already matches the flags", async () => {
    // The write is a server round trip that bumps the session's updated_at
    // and reorders the session list; when the persisted model already equals
    // --provider/--model it is a no-op and must not be sent.
    const persistedModel: ModelSelection = {
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.4",
    };
    const sessionModelResolver = vi.fn(async (model: ModelSelection) => model);
    const patchSessionModel = vi.fn(
      async ({ model }: { sessionId: string; model: ModelSelection }) => model
    );
    const sessionClient: PxiSessionClient = {
      createSession: async () => {
        throw new Error("not used");
      },
      listSessions: async () => [
        {
          id: "session-1",
          title: "Persisted session",
          updatedAt: "2026-07-24T13:00:00Z",
          isTemporary: false,
        },
      ],
      getSession: async ({ sessionId }) => ({
        id: sessionId,
        title: "Persisted session",
        updatedAt: "2026-07-24T13:00:00Z",
        isTemporary: false,
        isActive: false,
        messages: [],
        model: persistedModel,
      }),
      patchSessionModel,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={{ sendMessage: async () => null }}
        sessionClient={sessionClient}
        sessionModelResolver={sessionModelResolver}
      />
    );

    await writeInput({ stdin, input: "/sessions" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());

    expect(patchSessionModel).not.toHaveBeenCalled();
    expect(sessionModelResolver).toHaveBeenCalledWith(persistedModel);
    expect(stripAnsi(lastFrame() ?? "")).toContain("model: OPENAI/gpt-5.4");
    unmount();
  });

  it("keeps an in-flight /model pick when a send is rejected as model-stale", async () => {
    // The 409 refetch reads server state that predates the user's own write;
    // applying it would flip the header back and announce the reverse of
    // what the user did. The write guard must silence both.
    const persistedModel: ModelSelection = {
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.4",
    };
    const pickedModel: ModelSelection = {
      providerType: "builtin",
      provider: "ANTHROPIC",
      modelName: "claude-opus-4-6",
    };
    let resolveWrite: () => void = () => {};
    const patchSessionModel = vi.fn(
      ({ model }: { sessionId: string; model: ModelSelection }) =>
        new Promise<ModelSelection>((resolve) => {
          resolveWrite = () => resolve(model);
        })
    );
    const sessionClient: PxiSessionClient = {
      createSession: async () => {
        throw new Error("not used");
      },
      listSessions: async () => [
        {
          id: "session-1",
          title: "Persisted session",
          updatedAt: "2026-07-24T13:00:00Z",
          isTemporary: false,
        },
      ],
      // Always reports the pre-write model, standing in for the stale-send
      // refetch racing the write.
      getSession: async ({ sessionId }) => ({
        id: sessionId,
        title: "Persisted session",
        updatedAt: "2026-07-24T13:00:00Z",
        isTemporary: false,
        isActive: false,
        messages: [],
        model: persistedModel,
      }),
      patchSessionModel,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const client: PxiChatClient = {
      sendMessage: async () => {
        throw new Error("agent_session_model_stale");
      },
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions({ explicitModel: false })}
        client={client}
        sessionClient={sessionClient}
        sessionModelResolver={async (model: ModelSelection) => model}
        modelLoader={async () => [persistedModel, pickedModel]}
      />
    );

    await writeInput({ stdin, input: "/sessions" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());

    await writeInput({ stdin, input: "/model" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    await writeInput({ stdin, input: DOWN_ARROW });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "model: ANTHROPIC/claude-opus-4-6"
    );

    // The send 409s while the model write is still in flight.
    await writeInput({ stdin, input: "hello" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());

    let frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("model: ANTHROPIC/claude-opus-4-6");
    expect(frame).not.toContain("Model was changed elsewhere");

    await act(async () => {
      resolveWrite();
      await Promise.resolve();
    });
    frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("model: ANTHROPIC/claude-opus-4-6");
    expect(frame).not.toContain("Model was changed elsewhere");
    unmount();
  });

  it("names the new model when a send is rejected because it changed elsewhere", async () => {
    const originalModel: ModelSelection = {
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.4",
    };
    const remoteModel: ModelSelection = {
      providerType: "builtin",
      provider: "ANTHROPIC",
      modelName: "claude-opus-4-6",
    };
    let getSessionCallCount = 0;
    const sessionClient: PxiSessionClient = {
      createSession: async () => {
        throw new Error("not used");
      },
      listSessions: async () => [
        {
          id: "session-1",
          title: "Shared session",
          updatedAt: "2026-07-24T13:00:00Z",
          isTemporary: false,
        },
      ],
      getSession: async ({ sessionId }) => {
        getSessionCallCount += 1;
        return {
          id: sessionId,
          title: "Shared session",
          updatedAt: "2026-07-24T13:00:00Z",
          isTemporary: false,
          isActive: false,
          messages: [],
          // The first read restores the session; by the second another client
          // has moved it to a different model.
          model: getSessionCallCount === 1 ? originalModel : remoteModel,
        };
      },
      patchSessionModel: async ({ model }) => model,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const client: PxiChatClient = {
      sendMessage: async () => {
        throw new Error("agent_session_model_stale");
      },
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions({ explicitModel: false })}
        client={client}
        sessionClient={sessionClient}
        sessionModelResolver={async (model: ModelSelection) => model}
      />
    );

    await writeInput({ stdin, input: "/sessions" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());

    await writeInput({ stdin, input: "hello" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());

    const frame = stripAnsi(lastFrame() ?? "");
    // The transcript is untouched, so the notice must say the model moved
    // rather than that messages were refreshed.
    expect(frame).toContain(
      "Model was changed elsewhere, this session is now on ANTHROPIC/claude-opus-4-6"
    );
    expect(frame).not.toContain("the chat has been refreshed");
    // The unsent message is preserved for the user to resend.
    expect(frame).toContain("hello");
    unmount();
  });

  it("persists a /model pick and keeps it when a poll lands mid-write", async () => {
    vi.useFakeTimers();
    const persistedModel: ModelSelection = {
      providerType: "builtin",
      provider: "OPENAI",
      modelName: "gpt-5.4",
    };
    let resolveWrite: (model: ModelSelection) => void = () => {};
    const patchSessionModel = vi.fn(
      ({ model }: { sessionId: string; model: ModelSelection }) =>
        new Promise<ModelSelection>((resolve) => {
          resolveWrite = () => resolve(model);
        })
    );
    const sessionClient: PxiSessionClient = {
      createSession: async () => {
        throw new Error("not used");
      },
      listSessions: async () => [
        {
          id: "session-1",
          title: "Persisted session",
          updatedAt: "2026-07-24T13:00:00Z",
          isTemporary: false,
        },
      ],
      // Always reports the pre-change model, standing in for a poll whose
      // read raced the write.
      getSession: async ({ sessionId }) => ({
        id: sessionId,
        title: "Persisted session",
        updatedAt: "2026-07-24T13:00:00Z",
        isTemporary: false,
        isActive: false,
        messages: [],
        model: persistedModel,
      }),
      // The probe reports a moved tail so the poll performs the full fetch
      // whose stale model the optimistic pick must survive.
      getSessionSyncState: async () => ({
        isActive: false,
        updatedAt: "2026-07-24T13:05:00Z",
        lastMessageId: null,
      }),
      patchSessionModel,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions({ explicitModel: false })}
        client={{ sendMessage: async () => null }}
        sessionClient={sessionClient}
        sessionModelResolver={async (model: ModelSelection) => model}
        modelLoader={async () => [
          persistedModel,
          {
            providerType: "builtin",
            provider: "ANTHROPIC",
            modelName: "claude-opus-4-6",
          },
        ]}
      />
    );

    try {
      await writeInput({ stdin, input: "/sessions" });
      await writeInput({ stdin, input: "\r" });
      await act(async () => Promise.resolve());
      await writeInput({ stdin, input: "\r" });
      await act(async () => Promise.resolve());

      await writeInput({ stdin, input: "/model" });
      await writeInput({ stdin, input: "\r" });
      await act(async () => Promise.resolve());
      await writeInput({ stdin, input: DOWN_ARROW });
      await writeInput({ stdin, input: "\r" });
      await act(async () => Promise.resolve());

      expect(patchSessionModel).toHaveBeenCalledTimes(1);
      expect(stripAnsi(lastFrame() ?? "")).toContain(
        "model: ANTHROPIC/claude-opus-4-6"
      );

      // A poll tick lands while the write is still in flight and reports the
      // old model; the optimistic pick must survive it.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(stripAnsi(lastFrame() ?? "")).toContain(
        "model: ANTHROPIC/claude-opus-4-6"
      );

      await act(async () => {
        resolveWrite(persistedModel);
        await Promise.resolve();
      });
      expect(stripAnsi(lastFrame() ?? "")).toContain(
        "model: ANTHROPIC/claude-opus-4-6"
      );
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("reopens the session picker with the cached list while refreshing in the background", async () => {
    const initialSessions: PxiSessionSummary[] = [
      {
        id: "session-1",
        title: "First session",
        updatedAt: "2026-07-24T13:00:00Z",
        isTemporary: false,
      },
    ];
    let listCallCount = 0;
    let resolveRefresh: (sessions: PxiSessionSummary[]) => void = () => {};
    const sessionClient: PxiSessionClient = {
      createSession: async () => {
        throw new Error("not used");
      },
      listSessions: async () => {
        listCallCount += 1;
        if (listCallCount === 1) {
          return initialSessions;
        }
        return new Promise((resolve) => {
          resolveRefresh = resolve;
        });
      },
      getSession: async () => {
        throw new Error("not used");
      },
      getSessionSyncState: async () => {
        throw new Error("not used");
      },
      patchSessionModel: async ({ model }) => model,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        sessionClient={sessionClient}
      />
    );

    // First open fetches over the network and populates the cache.
    await writeInput({ stdin, input: "/sessions" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    expect(stripAnsi(lastFrame() ?? "")).toContain("First session");

    await writeInput({ stdin, input: ESCAPE_CHARACTER });
    await flushPendingEscapeInput();
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("Recent sessions");

    // Reopening shows the cached list immediately, with the refresh pending.
    await writeInput({ stdin, input: "/sessions" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    expect(listCallCount).toBe(2);
    expect(stripAnsi(lastFrame() ?? "")).toContain("First session");
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("Loading sessions");

    // When the background refresh lands, sessions created elsewhere appear.
    await act(async () => {
      resolveRefresh([
        {
          id: "session-2",
          title: "Fresh session",
          updatedAt: "2026-07-24T14:00:00Z",
          isTemporary: false,
        },
        ...initialSessions,
      ]);
      await Promise.resolve();
    });
    expect(stripAnsi(lastFrame() ?? "")).toContain("Fresh session");
    expect(stripAnsi(lastFrame() ?? "")).toContain("First session");
    unmount();
  });

  it("switches the active session model for the next request", async () => {
    const existingMessage: PxiMessage = {
      id: "existing-user",
      role: "user",
      parts: [{ type: "text", text: "keep this conversation" }],
    };
    const sessionClient: PxiSessionClient = {
      createSession: async () => ({
        id: "session-1",
        title: "Existing session",
        updatedAt: "2026-07-24T12:00:00Z",
        isTemporary: false,
        messages: [],
      }),
      listSessions: async () => [],
      getSession: async () => {
        throw new Error("not used");
      },
      getSessionSyncState: async () => {
        throw new Error("not used");
      },
      patchSessionModel: async ({ model }) => model,
      compactSession: async () => {
        throw new Error("not used");
      },
    };
    const modelLoader = vi.fn(
      async (): Promise<ModelSelection[]> => [
        {
          providerType: "builtin",
          provider: "OPENAI",
          modelName: "gpt-5.4",
        },
        {
          providerType: "builtin",
          provider: "GOOGLE",
          modelName: "gemini-3.5-flash",
        },
      ]
    );
    const clientFactory = vi.fn(
      ({
        options,
      }: {
        options: PxiRuntimeOptions;
        agentSessionId: string;
      }): PxiChatClient => ({
        sendMessage: async () => {
          expect(options.modelSelection).toEqual({
            providerType: "builtin",
            provider: "GOOGLE",
            modelName: "gemini-3.5-flash",
          });
          return null;
        },
      })
    );
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        clientFactory={clientFactory}
        modelLoader={modelLoader}
        sessionClient={sessionClient}
        initialMessages={[existingMessage]}
      />
    );

    await writeInput({ stdin, input: "/model" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    expect(stripAnsi(lastFrame() ?? "")).toContain("Recommended models");
    expect(stripAnsi(lastFrame() ?? "")).toContain("GOOGLE/gemini-3.5-flash");

    await writeInput({ stdin, input: DOWN_ARROW });
    await writeInput({ stdin, input: "\r" });

    const selectedFrame = stripAnsi(lastFrame() ?? "");
    expect(selectedFrame).toContain("model: GOOGLE/gemini-3.5-flash");
    expect(selectedFrame).toContain("keep this conversation");

    await writeInput({ stdin, input: "continue" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());

    expect(clientFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          modelSelection: {
            providerType: "builtin",
            provider: "GOOGLE",
            modelName: "gemini-3.5-flash",
          },
        }),
        agentSessionId: "session-1",
      })
    );
    unmount();
  });

  it("keeps model loading errors visible until the picker is retried", async () => {
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        modelLoader={async () => {
          throw new Error("Could not load models");
        }}
      />
    );

    await writeInput({ stdin, input: "/model" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    await writeInput({ stdin, input: "ignored filter" });

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Could not load models");
    expect(frame).toContain("esc close and retry");
    unmount();
  });

  it("shows an error for unknown slash commands", async () => {
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await act(async () => {
      stdin.write("/notacommand");
    });
    await act(async () => {
      stdin.write("\r");
    });

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Unknown command: /notacommand");
    unmount();
  });

  it("shows the latest assistant token usage on the bottom-right status line", () => {
    const assistantMessage: PxiMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "text", text: "Done.", state: "done" }],
      metadata: {
        phoenix: {
          type: "assistant",
          sessionId: "session-1",
          usage: {
            tokens: { prompt: 12000, completion: 345, total: 12345 },
            promptDetails: { cacheRead: 8000, cacheWrite: 200 },
          },
        },
      },
    };
    const { lastFrame, unmount } = render(
      <PxiApp options={createOptions()} initialMessages={[assistantMessage]} />
    );

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("12,345 tokens");
    expect(frame).toContain("cache read 8,000 / cache write 200");
    unmount();
  });

  it("omits the token usage status line until usage is reported", () => {
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    expect(stripAnsi(lastFrame() ?? "")).not.toContain("tokens");
    unmount();
  });

  it("renders assistant Phoenix-relative links with the configured endpoint", () => {
    const assistantMessage: PxiMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "Open [data retention](/settings/data).",
          state: "done",
        },
      ],
    };
    const { lastFrame, unmount } = render(
      <PxiApp
        options={createOptions({ endpoint: "https://example.com/phoenix" })}
        initialMessages={[assistantMessage]}
      />
    );

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("data retention");
    expect(frame).toContain("https://example.com/phoenix/settings/data");
    expect(frame).not.toContain("](/settings/data)");
    unmount();
  });
});

describe("PXI /compact command", () => {
  const persistedTranscript: PxiMessage[] = [
    {
      id: "user-1",
      role: "user",
      parts: [{ type: "text", text: "first question" }],
    },
    {
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "text", text: "first answer" }],
    },
  ];
  const checkpointMessage: PxiMessage = {
    id: "checkpoint-1",
    role: "user",
    metadata: {
      phoenix: { type: "user", isCompactionMessage: true },
    } as unknown as PxiMessage["metadata"],
    parts: [{ type: "text", text: "Summary of the conversation so far." }],
  };

  function createSessionClientWithPersistedSession({
    compactSession,
    isActive = false,
  }: {
    compactSession: PxiSessionClient["compactSession"];
    isActive?: boolean;
  }): PxiSessionClient {
    return {
      createSession: async () => {
        throw new Error("not used");
      },
      listSessions: async () => [
        {
          id: "session-1",
          title: "First session",
          updatedAt: "2026-07-24T12:00:00Z",
          isTemporary: false,
        },
      ],
      getSession: async ({ sessionId }: { sessionId: string }) => ({
        id: sessionId,
        title: "First session",
        updatedAt: "2026-07-24T12:00:00Z",
        isTemporary: false,
        isActive,
        messages: persistedTranscript,
        // Differs from the --provider/--model flags so restoring writes the
        // flag model instead of resolving against the server catalog.
        model: {
          providerType: "builtin",
          provider: "GOOGLE",
          modelName: "gemini-3.5-flash",
        } satisfies ModelSelection,
      }),
      patchSessionModel: async ({ model }) => model,
      compactSession,
    };
  }

  /** Activate the persisted session through the session picker. */
  async function restoreFirstSession({
    stdin,
  }: {
    stdin: { write: (input: string) => unknown };
  }) {
    await writeInput({ stdin, input: "/sessions" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
  }

  it("compacts the session and renders the checkpoint divider", async () => {
    const compactSession = vi.fn(async () => ({
      compacted: true,
      compactionMessage: checkpointMessage,
    }));
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        sessionClient={createSessionClientWithPersistedSession({
          compactSession,
        })}
      />
    );
    await restoreFirstSession({ stdin });

    await writeInput({ stdin, input: "/compact" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());

    expect(compactSession).toHaveBeenCalledWith({
      sessionId: "session-1",
      model: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-5.4",
      },
    });
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("Conversation compacted");
    expect(frame).toContain("Summary of the conversation so far.");
    unmount();
  });

  it("shows a notice when there is nothing to compact", async () => {
    const compactSession = vi.fn(async () => ({
      compacted: false,
      compactionMessage: null,
    }));
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        sessionClient={createSessionClientWithPersistedSession({
          compactSession,
        })}
      />
    );
    await restoreFirstSession({ stdin });

    await writeInput({ stdin, input: "/compact" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());

    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "Conversation is already compact"
    );
    unmount();
  });

  it("rejects /compact before any conversation is persisted", async () => {
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await writeInput({ stdin, input: "/compact" });
    await writeInput({ stdin, input: "\r" });

    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "There is no persisted conversation to compact."
    );
    unmount();
  });

  it("enters the busy state when the server rejects compaction as busy", async () => {
    const compactSession = vi.fn(async () => {
      throw new Error("agent_session_busy");
    });
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        sessionClient={createSessionClientWithPersistedSession({
          compactSession,
        })}
      />
    );
    await restoreFirstSession({ stdin });

    await writeInput({ stdin, input: "/compact" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());

    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain(
      "Session is being used elsewhere, the chat will refresh when complete"
    );
    expect(frame).not.toContain("Error:");
    unmount();
  });

  it("rejects /compact while the session is busy elsewhere", async () => {
    const compactSession = vi.fn(async () => {
      throw new Error("not used");
    });
    const client: PxiChatClient = { sendMessage: async () => null };
    const { lastFrame, stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        sessionClient={createSessionClientWithPersistedSession({
          compactSession,
          isActive: true,
        })}
      />
    );
    await restoreFirstSession({ stdin });

    await writeInput({ stdin, input: "/compact" });
    await writeInput({ stdin, input: "\r" });

    expect(compactSession).not.toHaveBeenCalled();
    expect(stripAnsi(lastFrame() ?? "")).toContain(
      "Try again when the other turn completes."
    );
    unmount();
  });

  it("sends trailing /compact text as a follow-up after the checkpoint", async () => {
    const compactSession = vi.fn(async () => ({
      compacted: true,
      compactionMessage: checkpointMessage,
    }));
    let capturedMessages: PxiMessage[] = [];
    const client: PxiChatClient = {
      sendMessage: async ({ messages }) => {
        capturedMessages = messages;
        return null;
      },
    };
    const { stdin, unmount } = render(
      <PxiApp
        options={createOptions()}
        client={client}
        sessionClient={createSessionClientWithPersistedSession({
          compactSession,
        })}
      />
    );
    await restoreFirstSession({ stdin });

    await writeInput({ stdin, input: "/compact continue from here" });
    await writeInput({ stdin, input: "\r" });
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());

    expect(capturedMessages.map((message) => message.id).slice(0, 3)).toEqual([
      "user-1",
      "assistant-1",
      "checkpoint-1",
    ]);
    const followUp = capturedMessages.at(-1);
    expect(followUp?.role).toBe("user");
    expect(followUp?.parts.find((part) => part.type === "text")?.text).toBe(
      "continue from here"
    );
    unmount();
  });
});
