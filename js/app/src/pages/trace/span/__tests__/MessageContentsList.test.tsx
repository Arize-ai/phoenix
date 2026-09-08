import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { MarkdownDisplayProvider } from "@phoenix/components/markdown";
import { PreferencesProvider } from "@phoenix/contexts";
import type { AttributeMessageContent } from "@phoenix/openInference/tracing/types";

import { MessageContentsList } from "../MessageContentsList";

installTestMatchMedia();
installTestStorage();

const REASONING_ID = "rs_05adbc9464d80cf8006a9b13e3760487d198f1e0f8c010edd6";

let container: HTMLDivElement;
let root: Root;

function renderContents(messageContents: AttributeMessageContent[]) {
  act(() => {
    root.render(
      <PreferencesProvider>
        <MarkdownDisplayProvider>
          <MessageContentsList messageContents={messageContents} />
        </MarkdownDisplayProvider>
      </PreferencesProvider>
    );
  });
}

function reasoningBlocks(): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-testid="reasoning-message-content"]'
    )
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("MessageContentsList", () => {
  // the summary is the model's thinking, not its answer, so it must not read
  // as one more paragraph of assistant prose
  it("sets a reasoning summary apart from the answer", () => {
    renderContents([
      {
        message_content: {
          type: "reasoning",
          id: REASONING_ID,
          text: "**Weighing the options**\n\nSix hours is 360 minutes.",
        },
      },
      { message_content: { type: "text", text: "The answer is 360 minutes." } },
    ]);

    const [block] = reasoningBlocks();
    expect(reasoningBlocks()).toHaveLength(1);
    expect(block.textContent).toContain("Reasoning");
    expect(block.textContent).toContain(REASONING_ID);
    expect(block.textContent).toContain("Six hours is 360 minutes.");
    // the answer renders outside the reasoning block
    expect(block.textContent).not.toContain("The answer is 360 minutes.");
    expect(container.textContent).toContain("The answer is 360 minutes.");
  });

  // the message card is already two cards deep; the thinking is context for
  // the answer rather than the answer, so it starts out of the way
  it("starts collapsed", () => {
    renderContents([
      {
        message_content: {
          type: "reasoning",
          id: REASONING_ID,
          text: "**Weighing the options**\n\nSix hours is 360 minutes.",
        },
      },
    ]);
    const [block] = reasoningBlocks();
    const panel = block.querySelector<HTMLElement>(".disclosure__panel");
    const trigger = block.querySelector<HTMLButtonElement>(
      '.react-aria-Button[slot="trigger"]'
    );
    expect(block.dataset.expanded).toBeUndefined();
    expect(panel?.hidden).toBe(true);
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  });

  // a closed row would otherwise say only "Reasoning"; the first line of the
  // summary tells the reader what the model was thinking about
  it("quotes the summary's first line without its markdown while collapsed", () => {
    renderContents([
      {
        message_content: {
          type: "reasoning",
          text: "**Weighing the options**\n\nSix hours is 360 minutes.",
        },
      },
    ]);
    const preview = reasoningBlocks()[0].querySelector(
      ".reasoning-message-content__preview"
    );
    expect(preview?.textContent).toMatch(/^Weighing the options/);
    expect(preview?.textContent).not.toContain("**");
  });

  it("offers the provider item id for copying", () => {
    renderContents([
      { message_content: { type: "reasoning", id: REASONING_ID, text: "…" } },
    ]);
    expect(
      reasoningBlocks()[0].querySelector(".copy-to-clipboard-button")
    ).not.toBeNull();
  });

  // OpenAI returns reasoning encrypted unless a summary is requested; a part
  // with no text used to render as an empty list item, hiding that the model
  // reasoned at all
  it("shows an encrypted-only reasoning part and says why it is unreadable", () => {
    renderContents([
      {
        message_content: {
          type: "reasoning",
          id: REASONING_ID,
          encrypted_content: "gAAAAABqmxPv…",
        },
      },
    ]);
    const [block] = reasoningBlocks();
    expect(block.textContent).toContain("encrypted");
    expect(block.textContent).not.toContain("gAAAAABqmxPv");
    // the closed row says so too, so nobody opens it to find nothing
    expect(
      block.querySelector(".reasoning-message-content__preview")?.textContent
    ).toBe("Encrypted");
  });

  it("describes redacted thinking as redacted", () => {
    renderContents([
      { message_content: { type: "reasoning", data: "EmwKAhgB…" } },
    ]);
    expect(reasoningBlocks()[0].textContent).toContain("redacted");
    // nothing to identify the part by, so nothing to copy
    expect(
      reasoningBlocks()[0].querySelector(".copy-to-clipboard-button")
    ).toBeNull();
  });

  it("leaves text and image parts as they were", () => {
    renderContents([
      { message_content: { type: "text", text: "What is in this image?" } },
      {
        message_content: {
          type: "image",
          image: { image: { url: "data:image/png," } },
        },
      },
    ]);
    expect(reasoningBlocks()).toHaveLength(0);
    expect(container.textContent).toContain("What is in this image?");
    expect(container.querySelector("img")).not.toBeNull();
  });
});
