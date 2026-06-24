import { render } from "ink-testing-library";
import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { PxiApp, ThinkingIndicator } from "../src/pxi/App";
import { resolvePxiRuntimeOptions } from "../src/pxi/options";
import type { PxiChatClient, PxiMessage } from "../src/pxi/types";

function createOptions() {
  return resolvePxiRuntimeOptions({
    cliOptions: {
      endpoint: "http://localhost:6006",
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

    expect(lastFrame()).toContain("PXI");
    expect(lastFrame()).toContain("endpoint: http://localhost:6006");
    expect(lastFrame()).toContain("model: OPENAI/gpt-5.4");
    expect(lastFrame()).toContain("Ask a question");
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
    expect(frame).toContain("tool: phoenix_graphql Complete");
    expect(lastFrame()).toContain("result object (2 keys: data, errors)");
    expect(frame).toContain("Then I summarized it.");
    expect(frame.indexOf("I checked the project.")).toBeLessThan(
      frame.indexOf("tool: phoenix_graphql Complete")
    );
    expect(frame.indexOf("tool: phoenix_graphql Complete")).toBeLessThan(
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

    expect(lastFrame()).toContain("Projects:");
    expect(lastFrame()).toContain("┌");
    expect(lastFrame()).toContain("│ Name");
    expect(lastFrame()).not.toContain("| --- |");
    unmount();
  });
});
