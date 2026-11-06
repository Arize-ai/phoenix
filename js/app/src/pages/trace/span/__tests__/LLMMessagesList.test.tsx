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

/** A turn carrying only an image, which previews as nothing at all. */
const IMAGE_MESSAGE: AttributeMessage = {
  role: "user",
  contents: [
    {
      message_content: {
        type: "image",
        image: { image: { url: "data:image/png," } },
      },
    },
  ],
};

const TOGGLE_SELECTOR =
  'button[aria-label="Expand all input messages"],' +
  'button[aria-label="Collapse all input messages"]';

let container: HTMLDivElement;
let root: Root;

function renderMessages(messages: AttributeMessage[], spanId = "span-1") {
  act(() => {
    root.render(
      <PreferencesProvider>
        <LLMMessagesCollapseProvider spanId={spanId} messages={messages}>
          <LLMMessagesCollapseToggle scope="input" />
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
  const button = container.querySelector<HTMLElement>(TOGGLE_SELECTOR);
  if (button === null) {
    throw new Error("no collapse toggle rendered");
  }
  return button;
}

/** The collapse toggle on the header of the message at `index`. */
function messageHeaderButton(index: number): Element {
  return container.querySelectorAll("li > .card button")[index];
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

  // collapsing a message the preview cannot describe would leave a bare role
  // header and hide the only thing the turn carries
  it("leaves a message with no preview expanded", () => {
    renderMessages([MESSAGES[0], IMAGE_MESSAGE, MESSAGES[2]]);
    expect(collapsedStates()).toEqual([true, false, false]);
  });

  it("lets a reader open an earlier message on its own", () => {
    renderMessages(MESSAGES);
    press(messageHeaderButton(0));
    expect(collapsedStates()).toEqual([false, true, false]);
  });

  // the provider stays mounted across spans so the cards around it keep their
  // own state, so it has to start the messages over itself
  it("starts over when the reader moves to another span", () => {
    renderMessages(MESSAGES);
    press(toggleButton());
    expect(collapsedStates()).toEqual([false, false, false]);

    renderMessages(MESSAGES, "span-2");
    expect(collapsedStates()).toEqual([true, true, false]);
  });

  describe("the collapse toggle", () => {
    // the list arrives mostly collapsed, so opening it up is the move the
    // control has to offer first
    it("expands every message, then collapses every message", () => {
      renderMessages(MESSAGES);
      expect(toggleButton().getAttribute("aria-label")).toBe(
        "Expand all input messages"
      );

      press(toggleButton());
      expect(collapsedStates()).toEqual([false, false, false]);

      // with nothing left to expand the control offers the way back
      expect(toggleButton().getAttribute("aria-label")).toBe(
        "Collapse all input messages"
      );
      press(toggleButton());
      expect(collapsedStates()).toEqual([true, true, true]);
    });

    // an expand that only reached the last message would look like a no-op
    it("keeps offering the expand while some messages are still collapsed", () => {
      renderMessages(MESSAGES);
      press(messageHeaderButton(0));
      expect(toggleButton().getAttribute("aria-label")).toBe(
        "Expand all input messages"
      );
    });

    // a message the span was still being written when the reader collapsed the
    // list should not show up expanded on its own
    it("holds a collapse across a message arriving later", () => {
      renderMessages(MESSAGES);
      press(toggleButton());
      press(toggleButton());
      expect(collapsedStates()).toEqual([true, true, true]);

      renderMessages([
        ...MESSAGES,
        { role: "assistant", content: "…and Rome" },
      ]);
      expect(collapsedStates()).toEqual([true, true, true, true]);
    });

    it("names the side of the span it acts on", () => {
      act(() => {
        root.render(
          <PreferencesProvider>
            <LLMMessagesCollapseProvider spanId="span-1" messages={MESSAGES}>
              <LLMMessagesCollapseToggle scope="output" />
            </LLMMessagesCollapseProvider>
          </PreferencesProvider>
        );
      });
      expect(
        container.querySelector("button")?.getAttribute("aria-label")
      ).toBe("Expand all output messages");
    });

    it("is not rendered for a single message", () => {
      renderMessages(MESSAGES.slice(-1));
      expect(container.querySelector(TOGGLE_SELECTOR)).toBeNull();
    });
  });
});
