import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { SpanNotesListContent } from "@phoenix/pages/trace/SpanNotesList";

let container: HTMLDivElement;
let root: Root;
const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("SpanNotesListContent", () => {
  it("renders an empty state when the span has no notes", () => {
    act(() => {
      root.render(
        <PreferencesProvider>
          <SpanNotesListContent notes={[]} />
        </PreferencesProvider>
      );
    });

    expect(container.textContent).toContain("No notes for this span");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders notes in their provided stack order", () => {
    act(() => {
      root.render(
        <PreferencesProvider>
          <SpanNotesListContent
            notes={[
              {
                id: "note-1",
                explanation: "First observation",
                createdAt: "2026-07-23T16:00:00.000Z",
                user: { username: "alice" },
              },
              {
                id: "note-2",
                explanation: "Second observation",
                createdAt: "2026-07-23T16:01:00.000Z",
                user: null,
              },
            ]}
          />
        </PreferencesProvider>
      );
    });

    const notes = Array.from(container.querySelectorAll("li"));
    expect(notes).toHaveLength(2);
    expect(notes[0]?.textContent).toContain("alice");
    expect(notes[0]?.textContent).toContain("First observation");
    expect(notes[1]?.textContent).toContain("system");
    expect(notes[1]?.textContent).toContain("Second observation");
  });

  it("scrolls a newly created note into view and marks it for fade-in", () => {
    act(() => {
      root.render(
        <PreferencesProvider>
          <SpanNotesListContent
            newNoteId="note-2"
            notes={[
              {
                id: "note-1",
                explanation: "First observation",
                createdAt: "2026-07-23T16:00:00.000Z",
                user: { username: "alice" },
              },
              {
                id: "note-2",
                explanation: "New observation",
                createdAt: "2026-07-23T16:01:00.000Z",
                user: { username: "alice" },
              },
            ]}
          />
        </PreferencesProvider>
      );
    });

    const notes = container.querySelectorAll("li");
    expect(notes.item(0).getAttribute("data-new-note")).toBe("false");
    expect(notes.item(1).getAttribute("data-new-note")).toBe("true");
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
  });
});
