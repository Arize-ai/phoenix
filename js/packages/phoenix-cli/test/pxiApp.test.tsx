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
    expect(lastFrame()).toContain("Enter sends.");
    expect(lastFrame()).toContain("Shift+Enter inserts a newline.");
    unmount();
  });

  it("uses Shift+Enter to insert a newline before submitting", async () => {
    let submittedText: string | undefined;
    const client: PxiChatClient = {
      sendMessage: async ({ messages }) => {
        const userMessage = messages.at(-1);
        const textPart = userMessage?.parts.find(
          (part) => part.type === "text"
        );
        submittedText = textPart?.text;
        return null;
      },
    };
    const { stdin, unmount } = render(
      <PxiApp options={createOptions()} client={client} />
    );

    await act(async () => {
      stdin.write("first line");
    });
    await act(async () => {
      stdin.write(KITTY_SHIFT_ENTER);
    });
    await act(async () => {
      stdin.write("second line");
    });
    await act(async () => {
      stdin.write("\r");
    });

    expect(submittedText).toBe("first line\nsecond line");
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

    const frame = lastFrame() ?? "";
    expect(frame).toContain("I checked the project.");
    expect(frame).toContain("[tool] phoenix_graphql Complete");
    expect(lastFrame()).not.toContain("result object (2 keys: data, errors)");
    expect(frame).toContain("Then I summarized it.");
    expect(frame.indexOf("I checked the project.")).toBeLessThan(
      frame.indexOf("[tool] phoenix_graphql Complete")
    );
    expect(frame.indexOf("[tool] phoenix_graphql Complete")).toBeLessThan(
      frame.indexOf("Then I summarized it.")
    );
    expect(lastFrame()).not.toContain('{"data"');
    expect(lastFrame()).not.toContain("╭");
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
    expect(frame).toContain("Enter sends.");
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
