import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { PreferencesProvider } from "@phoenix/contexts";
import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { LLMMessagesCollapseProvider } from "../LLMMessagesCollapseContext";
import { LLMMessagesCollapseToggle } from "../LLMMessagesCollapseToggle";
import { LLMMessagesList } from "../LLMMessagesList";

installTestMatchMedia();
installTestStorage();

const MESSAGES: AttributeMessage[] = [
  { role: "system", content: "you are a helpful assistant" },
  { role: "user", content: "what is the capital of France?" },
  { role: "assistant", content: "Paris" },
];

let container: HTMLDivElement;
let root: Root;

function renderMessages(messages: AttributeMessage[]) {
  act(() => {
    root.render(
      <PreferencesProvider>
        <LLMMessagesCollapseProvider messageCount={messages.length}>
          <LLMMessagesCollapseToggle />
          <LLMMessagesList messages={messages} />
        </LLMMessagesCollapseProvider>
      </PreferencesProvider>
    );
  });
}

/** The collapsed state of each message card, in list order. */
function collapsedStates(): boolean[] {
  return Array.from(container.querySelectorAll("li > .card")).map(
    (card) => card.getAttribute("data-collapsed") === "true"
  );
}

function toggleButton(): HTMLElement {
  const button = container.querySelector<HTMLElement>("button[aria-label]");
  if (button === null) {
    throw new Error("no collapse toggle rendered");
  }
  return button;
}

function press(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
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

describe("LLMMessagesList", () => {
  // the history is mostly turns the reader has already seen; the last message
  // is the one they opened the span for
  it("collapses every message except the last", () => {
    renderMessages(MESSAGES);
    expect(collapsedStates()).toEqual([true, true, false]);
  });

  it("leaves a lone message expanded", () => {
    renderMessages(MESSAGES.slice(-1));
    expect(collapsedStates()).toEqual([false]);
  });

  it("lets a reader open an earlier message on its own", () => {
    renderMessages(MESSAGES);
    press(container.querySelectorAll("li > .card button")[0]);
    expect(collapsedStates()).toEqual([false, true, false]);
  });

  describe("the collapse toggle", () => {
    it("collapses every message, then expands every message", () => {
      renderMessages(MESSAGES);
      expect(toggleButton().getAttribute("aria-label")).toBe(
        "Collapse all messages"
      );

      press(toggleButton());
      expect(collapsedStates()).toEqual([true, true, true]);

      // with nothing left to collapse the control offers the way back
      expect(toggleButton().getAttribute("aria-label")).toBe(
        "Expand all messages"
      );
      press(toggleButton());
      expect(collapsedStates()).toEqual([false, false, false]);
    });

    it("is not rendered for a single message", () => {
      renderMessages(MESSAGES.slice(-1));
      expect(container.querySelector("button[aria-label]")).toBeNull();
    });
  });
});
