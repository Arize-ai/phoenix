import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

const relayMocks = vi.hoisted(() => ({ addNote: vi.fn() }));

vi.mock("react-relay", () => ({
  graphql: vi.fn(),
  useMutation: () => [relayMocks.addNote, false],
}));

import { SpanNoteBar } from "../SpanNoteBar";
import { SpanNoteBarProvider } from "../SpanNoteBarContext";

describe("SpanNoteBar", () => {
  installTestMatchMedia();

  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    relayMocks.addNote.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderBar({
    onNoteCreated,
    spanNodeId,
  }: {
    onNoteCreated?: (noteId: string) => void;
    spanNodeId: string;
  }) {
    act(() => {
      root.render(
        <ThemeProvider>
          <PreferencesProvider isTakingSpanNotes>
            <SpanNoteBarProvider isHotkeyEnabled={false}>
              <SpanNoteBar
                onNoteCreated={onNoteCreated}
                spanNodeId={spanNodeId}
              />
            </SpanNoteBarProvider>
          </PreferencesProvider>
        </ThemeProvider>
      );
    });
  }

  function getTextarea() {
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) throw new Error("Expected note textarea");
    return textarea;
  }

  function setNoteText(noteText: string) {
    const textarea = getTextarea();
    const setTextareaValue = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set?.bind(textarea);
    if (!setTextareaValue) throw new Error("Expected textarea value setter");
    act(() => {
      setTextareaValue(noteText);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function submitNote() {
    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add note"]'
    );
    if (!button) throw new Error("Expected Add Note button");
    act(() => button.click());
  }

  it("keeps exactly one composer and binds drafts to their spans", () => {
    renderBar({ spanNodeId: "span-a" });
    const composerRow = container.querySelector(".span-note-bar__row");
    const closeButton = container.querySelector(
      'button[aria-label="Close notes"]'
    );
    expect(closeButton?.getAttribute("data-variant")).toBe("quiet");
    expect(closeButton?.getAttribute("data-childless")).toBe("true");
    expect(closeButton?.querySelector(".icon-wrap")).not.toBeNull();
    expect(composerRow?.lastElementChild).toBe(closeButton);
    expect(container.textContent).not.toContain("Close notes");
    const addNoteButton = container.querySelector(
      'button[aria-label="Add note"]'
    );
    expect(addNoteButton?.getAttribute("data-size")).toBe("S");
    expect(addNoteButton?.querySelector(".icon-wrap")).not.toBeNull();
    expect(container.textContent).not.toContain("Add Note");
    setNoteText("Draft for A");

    renderBar({ spanNodeId: "span-b" });
    expect(getTextarea().value).toBe("");
    setNoteText("Draft for B");

    renderBar({ spanNodeId: "span-a" });
    expect(getTextarea().value).toBe("Draft for A");
    expect(container.querySelectorAll(".span-note-bar")).toHaveLength(1);

    renderBar({ spanNodeId: "span-b" });
    expect(getTextarea().value).toBe("Draft for B");
  });

  it("submits to the draft's span and does not overwrite newer text on error", () => {
    renderBar({ spanNodeId: "span-a" });
    setNoteText("First draft");
    submitNote();

    expect(relayMocks.addNote).toHaveBeenCalledOnce();
    expect(relayMocks.addNote.mock.calls[0]?.[0].variables).toEqual({
      input: { note: "First draft", spanId: "span-a" },
      spanNodeId: "span-a",
    });
    expect(getTextarea().value).toBe("");

    setNoteText("Newer draft");
    act(() => {
      relayMocks.addNote.mock.calls[0]?.[0].onError(new Error("Write failed"));
    });

    expect(getTextarea().value).toBe("Newer draft");
    expect(container.textContent).toContain("Failed to add note");
    expect(container.textContent).toContain("Write failed");
  });

  it("reports the created note after Relay publishes the mutation response", () => {
    const onNoteCreated = vi.fn();
    renderBar({ onNoteCreated, spanNodeId: "span-a" });
    setNoteText("New observation");
    submitNote();

    act(() => {
      relayMocks.addNote.mock.calls[0]?.[0].onCompleted({
        createSpanNote: {
          spanAnnotations: [{ id: "new-note-id" }],
        },
      });
    });

    expect(onNoteCreated).toHaveBeenCalledWith("new-note-id");
  });
});
