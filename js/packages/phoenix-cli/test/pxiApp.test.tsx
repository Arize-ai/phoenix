import { render } from "ink-testing-library";
import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { PxiApp, ThinkingIndicator } from "../src/pxi/App";
import { resolvePxiRuntimeOptions } from "../src/pxi/options";
import type { PxiChatClient, PxiMessage } from "../src/pxi/types";

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
}: {
  endpoint?: string;
} = {}) {
  return resolvePxiRuntimeOptions({
    cliOptions: {
      endpoint,
      provider: "OPENAI",
      model: "gpt-5.4",
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

  it("shows a bash summary and a spinner while its input streams in", () => {
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
    expect(frame).toContain("$ bash · Run the unit test suite");
    expect(frame).toContain("⠋");
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
    expect(frame).toContain("Clear the conversation history");
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
        sessionId: "session-1",
        usage: {
          tokens: { prompt: 12000, completion: 345, total: 12345 },
          promptDetails: { cacheRead: 8000, cacheWrite: 200 },
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
