import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestScrollIntoView } from "@phoenix/__tests__/installTestScrollIntoView";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { PreferencesProvider } from "@phoenix/contexts";
import type { AttributeMessage } from "@phoenix/openInference/tracing/types";

import { LLMMessagesCollapseProvider } from "../LLMMessagesCollapseContext";
import { LLMMessagesCollapseToggle } from "../LLMMessagesCollapseToggle";
import { LLMMessagesList } from "../LLMMessagesList";
import { LLMMessagesSearch } from "../LLMMessagesSearch";
import { LLMMessagesSearchProvider } from "../LLMMessagesSearchContext";

installTestMatchMedia();
installTestStorage();
const scrolled = installTestScrollIntoView();

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

/** Comfortably past the search field's own debounce. */
const DEBOUNCE_SETTLE_MS = 350;

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

/**
 * The same list, wrapped in a search. Search sits outside collapse so that a
 * match can open the message it landed on.
 */
function renderSearchableMessages(
  messages: AttributeMessage[],
  spanId = "span-1"
) {
  act(() => {
    root.render(
      <PreferencesProvider>
        <LLMMessagesSearchProvider spanId={spanId} messages={messages}>
          <LLMMessagesCollapseProvider spanId={spanId} messages={messages}>
            <LLMMessagesSearch scope="input" />
            <LLMMessagesCollapseToggle scope="input" />
            <LLMMessagesList messages={messages} />
          </LLMMessagesCollapseProvider>
        </LLMMessagesSearchProvider>
      </PreferencesProvider>
    );
  });
}

function searchField(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Search input messages"]'
  );
  if (input === null) {
    throw new Error("no search field rendered");
  }
  return input;
}

/**
 * Types into the uncontrolled field the way a reader would, then waits out the
 * debounce the field applies before it reports the change.
 */
async function typeQuery(value: string) {
  const input = searchField();
  const setValue = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  act(() => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_SETTLE_MS));
  });
}

/** The live region the match readout is announced through. */
function liveRegion(): HTMLElement {
  const region = container.querySelector<HTMLElement>('[role="status"]');
  if (region === null) {
    throw new Error("no live region rendered");
  }
  return region;
}

/** Steps to the next match and lets the announcement settle onto its frame. */
async function goToNextMatch() {
  const next = container.querySelector(
    'button[aria-label="Next match in input messages"]'
  );
  if (next === null) {
    throw new Error("no next-match button rendered");
  }
  press(next);
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
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

describe("LLMMessagesSearch", () => {
  // Regression guard. The field is uncontrolled, so it holds whatever was typed
  // into it until it is replaced. Moving to another span clears the query, and
  // without a fresh field the box went on showing a query that no longer
  // matched anything: text in the box, nothing marked, no count.
  it("clears the field when the reader moves to another span", async () => {
    renderSearchableMessages(MESSAGES, "span-1");
    await typeQuery("Paris");
    expect(searchField().value).toBe("Paris");

    renderSearchableMessages(MESSAGES, "span-2");

    expect(searchField().value).toBe("");
    expect(container.querySelectorAll("li.llm-message--match")).toHaveLength(0);
  });

  it("marks the messages that match and leaves the rest alone", async () => {
    renderSearchableMessages(MESSAGES, "span-1");
    await typeQuery("capital");

    const marked = container.querySelectorAll("li.llm-message--match");
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toContain("capital of France");
  });

  // A match the reader cannot see is not a match they can use: a collapsed card
  // is `display: none`, which hides it from the page and from a screen reader.
  it("opens a collapsed message that matches", async () => {
    renderSearchableMessages(MESSAGES, "span-1");
    // the middle message starts collapsed, since only the last one is open
    expect(collapsedStates()).toEqual([true, true, false]);

    await typeQuery("capital");

    expect(collapsedStates()[1]).toBe(false);
  });

  // Regression guard. Search used to be checked above the bulk toggle, so a
  // matching message re-opened itself on the same render the reader collapsed
  // it, and the control flipped straight back to offering the expand.
  it("lets the reader collapse a matching message with the bulk toggle", async () => {
    renderSearchableMessages(MESSAGES, "span-1");
    await typeQuery("capital");
    expect(collapsedStates()[1]).toBe(false);

    press(toggleButton());
    press(toggleButton());

    expect(collapsedStates()).toEqual([true, true, true]);
    // still marked: the outline is what says the message matched once the
    // reader has shut it
    expect(container.querySelectorAll("li.llm-message--match")).toHaveLength(1);
  });

  // Being taken somewhere is a request about one message, so it beats the bulk
  // toggle the same way clicking that card would. Without this, stepping after
  // a collapse-all scrolls to a card whose matched text cannot be read.
  it("opens the match it takes the reader to, even after a collapse all", async () => {
    renderSearchableMessages(MESSAGES, "span-1");
    await typeQuery("capital");

    press(toggleButton());
    press(toggleButton());
    expect(collapsedStates()).toEqual([true, true, true]);

    await goToNextMatch();

    // only the one stepped to. The bulk collapse still holds for the rest
    expect(collapsedStates()).toEqual([true, false, true]);
  });

  // Collapsing everything and then searching is a normal thing to do. `false`
  // is not nullish, so a standing collapse would sit above the match in the
  // chain and leave the search marking cards it could never open.
  it("opens matches when a search starts after a collapse all", async () => {
    renderSearchableMessages(MESSAGES, "span-1");

    press(toggleButton()); // expand all
    press(toggleButton()); // collapse all
    expect(collapsedStates()).toEqual([true, true, true]);

    await typeQuery("capital");

    expect(container.querySelectorAll("li.llm-message--match")).toHaveLength(1);
    expect(collapsedStates()[1]).toBe(false);
  });

  // The bulk toggle is a standing choice about the list, not an answer to any
  // one query, so it outlives the query that was running when it was made.
  it("holds a collapse across the next query", async () => {
    renderSearchableMessages(MESSAGES, "span-1");
    await typeQuery("capital");
    press(toggleButton());
    press(toggleButton());

    await typeQuery("Paris");

    expect(collapsedStates()).toEqual([true, true, true]);
  });

  // The region has to be in the DOM before its content changes, because a screen reader
  // watches a region it already knows about rather than discovering one that
  // appears already holding its message.
  it("keeps the live region mounted before a search starts", () => {
    renderSearchableMessages(MESSAGES, "span-1");
    expect(liveRegion().textContent).toBe("");
  });

  // "2 of 7" is the whole of what a sighted reader needs, because the scroll
  // and the highlight already showed them where they are. Spoken on its own it
  // is a number with nothing attached to it.
  it("names the message it took the reader to", async () => {
    renderSearchableMessages(MESSAGES, "span-1");
    await typeQuery("a");
    await goToNextMatch();

    expect(liveRegion().textContent).toBe(
      "1 of 3, system: you are a helpful assistant"
    );
    // and the sighted reader is taken to the same message
    expect(scrolled.calls.at(-1)?.getAttribute("data-message-index")).toBe("0");
  });

  it("leaves the list untouched for an empty or whitespace-only query", async () => {
    renderSearchableMessages(MESSAGES, "span-1");
    const before = collapsedStates();

    await typeQuery("   ");

    expect(collapsedStates()).toEqual(before);
    expect(container.querySelectorAll("li.llm-message--match")).toHaveLength(0);
  });
  // The custom highlight API is what marks the matched text itself, and it does
  // not exist in this environment. The hook has to notice that and do nothing,
  // rather than throwing and taking the whole message list down with it. The
  // card outline still says which messages matched, so the feature degrades to
  // what it was before the highlighting rather than breaking.
  it("renders where the browser cannot paint highlights", async () => {
    expect("highlights" in CSS).toBe(false);

    renderSearchableMessages(MESSAGES, "span-1");
    await typeQuery("capital");

    expect(container.querySelectorAll("li.llm-message--match")).toHaveLength(1);
  });
});
