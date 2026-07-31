import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import { SpanNotesListContent } from "@phoenix/pages/trace/SpanNotesList";

let container: HTMLDivElement;
let root: Root;
const scrollIntoView = vi.fn();
const onDeleteNote = vi.fn(async (_noteId: string) => ({
  success: true as const,
}));
const onUpdateNote = vi.fn(
  async (_params: { noteId: string; noteText: string }) => ({
    success: true as const,
  })
);

function TestProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <PreferencesProvider>{children}</PreferencesProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  scrollIntoView.mockReset();
  onDeleteNote.mockReset();
  onDeleteNote.mockResolvedValue({ success: true });
  onUpdateNote.mockReset();
  onUpdateNote.mockResolvedValue({ success: true });
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
  installTestMatchMedia();

  it("renders an empty state when the span has no notes", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanNotesListContent
            notes={[]}
            onDeleteNote={onDeleteNote}
            onUpdateNote={onUpdateNote}
          />
        </TestProviders>
      );
    });

    expect(container.textContent).toContain("No notes for this span");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders notes in their provided stack order", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanNotesListContent
            onDeleteNote={onDeleteNote}
            onUpdateNote={onUpdateNote}
            notes={[
              {
                id: "note-1",
                explanation: "First observation",
                createdAt: "2026-07-23T16:00:00.000Z",
                updatedAt: "2026-07-23T16:00:00.000Z",
                user: { username: "alice" },
              },
              {
                id: "note-2",
                explanation: "Second observation",
                createdAt: "2026-07-23T16:01:00.000Z",
                updatedAt: "2026-07-23T16:01:00.000Z",
                user: null,
              },
            ]}
          />
        </TestProviders>
      );
    });

    const notes = Array.from(container.querySelectorAll("li"));
    const notesList = container.querySelector("ul");
    expect(notes).toHaveLength(2);
    expect(getComputedStyle(notesList!).padding).toBe("0px");
    expect(notes[0]?.textContent).toContain("alice");
    expect(notes[0]?.textContent).toContain("First observation");
    expect(notes[1]?.textContent).toContain("system");
    expect(notes[1]?.textContent).toContain("Second observation");
    const firstNoteText = notes[0]?.querySelector(".span-note__text");
    const firstNoteTextSurface = notes[0]?.querySelector(
      ".span-note__text-surface"
    );
    const firstNoteFrame = notes[0]?.querySelector<HTMLElement>(
      "[data-span-note-frame]"
    );
    const firstNoteFooter =
      notes[0]?.querySelector<HTMLElement>(".span-note__footer");
    const firstNoteAuthor =
      firstNoteFooter?.querySelector<HTMLElement>(".span-note__author");
    const firstNoteActions = firstNoteFooter?.querySelector<HTMLElement>(
      ".span-note__actions"
    );
    expect(firstNoteText?.compareDocumentPosition(firstNoteFooter!) ?? 0).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(firstNoteText?.parentElement).toBe(firstNoteTextSurface);
    expect(firstNoteFrame?.getAttribute("data-framed")).toBe("false");
    expect(firstNoteFrame?.style.padding).toBe("");
    expect(getComputedStyle(firstNoteFrame?.firstElementChild!).gap).toBe(
      "var(--global-dimension-size-100)"
    );
    expect(getComputedStyle(firstNoteFooter!).display).toBe("flex");
    expect(getComputedStyle(firstNoteFooter!).justifyContent).toBe(
      "space-between"
    );
    expect(getComputedStyle(firstNoteAuthor!).display).toBe("flex");
    expect(getComputedStyle(firstNoteAuthor!).flexDirection).toBe("row");
    expect(getComputedStyle(firstNoteActions!).display).toBe("flex");
    const firstNoteAvatar = firstNoteAuthor?.firstElementChild;
    expect(firstNoteAvatar).not.toBeNull();
    expect(getComputedStyle(firstNoteAvatar!).width).toBe("20px");
    expect(firstNoteAuthor?.textContent).toContain("alice");
    expect(
      Array.from(firstNoteAuthor?.querySelectorAll(".text") ?? []).map((text) =>
        text.getAttribute("data-size")
      )
    ).toEqual(["XS", "XS"]);
    expect(firstNoteAuthor?.querySelector("time")?.textContent).toMatch(
      /^\w{3} \d{1,2}, 2026, \d{1,2}:\d{2} [AP]M$/
    );
    expect(firstNoteActions?.textContent).toBe("EditDelete");
  });

  it("scrolls a newly created note into view and marks it for fade-in", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanNotesListContent
            newNoteId="note-2"
            onDeleteNote={onDeleteNote}
            onUpdateNote={onUpdateNote}
            notes={[
              {
                id: "note-1",
                explanation: "First observation",
                createdAt: "2026-07-23T16:00:00.000Z",
                updatedAt: "2026-07-23T16:00:00.000Z",
                user: { username: "alice" },
              },
              {
                id: "note-2",
                explanation: "New observation",
                createdAt: "2026-07-23T16:01:00.000Z",
                updatedAt: "2026-07-23T16:01:00.000Z",
                user: { username: "alice" },
              },
            ]}
          />
        </TestProviders>
      );
    });

    const notes = container.querySelectorAll("li");
    expect(notes.item(0).getAttribute("data-new-note")).toBe("false");
    expect(notes.item(1).getAttribute("data-new-note")).toBe("true");
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "nearest",
      inline: "nearest",
    });
    expect(
      getComputedStyle(
        notes.item(1).querySelector<HTMLElement>(".span-note__footer")!
      ).scrollMarginBlockEnd
    ).toBe("var(--global-dimension-size-200)");
  });

  it("keeps resting note actions visible and available to keyboard focus", async () => {
    const user = userEvent.setup();
    act(() => {
      root.render(
        <TestProviders>
          <SpanNotesListContent
            notes={[
              {
                id: "note-1",
                explanation: "First observation",
                createdAt: "2026-07-23T16:00:00.000Z",
                updatedAt: "2026-07-23T16:00:00.000Z",
                user: { username: "alice" },
              },
            ]}
            onDeleteNote={onDeleteNote}
            onUpdateNote={onUpdateNote}
          />
        </TestProviders>
      );
    });

    const actions = container.querySelector<HTMLElement>(".span-note__actions");
    const editButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent === "Edit");
    expect(getComputedStyle(actions!).opacity).toBe("1");

    await act(async () => user.tab());
    expect(document.activeElement).toBe(editButton);
    expect(getComputedStyle(actions!).opacity).toBe("1");
  });

  it("replaces the author row with inline delete confirmation", async () => {
    const user = userEvent.setup();
    act(() => {
      root.render(
        <TestProviders>
          <SpanNotesListContent
            notes={[
              {
                id: "note-1",
                explanation: "First observation",
                createdAt: "2026-07-23T16:00:00.000Z",
                updatedAt: "2026-07-23T16:00:00.000Z",
                user: { username: "alice" },
              },
            ]}
            onDeleteNote={onDeleteNote}
            onUpdateNote={onUpdateNote}
          />
        </TestProviders>
      );
    });

    await act(async () =>
      user.click(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>("button")
        ).find((button) => button.textContent === "Delete")!
      )
    );

    const footer = container.querySelector(".span-note__footer");
    expect(footer?.textContent).toContain("Confirm");
    expect(footer?.textContent).toContain("Cancel");
    expect(footer?.textContent).toContain("Delete");
    expect(footer?.textContent).not.toContain("alice");
    expect(
      container
        .querySelector(".span-note__text")
        ?.getAttribute("data-confirming-delete")
    ).toBe("true");

    await act(async () =>
      user.click(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>("button")
        ).find((button) => button.textContent === "Cancel")!
      )
    );

    expect(footer?.textContent).toContain("alice");
    expect(footer?.textContent).not.toContain("Confirm");
  });

  it("deletes a note after inline confirmation", async () => {
    const user = userEvent.setup();
    act(() => {
      root.render(
        <TestProviders>
          <SpanNotesListContent
            notes={[
              {
                id: "note-1",
                explanation: "First observation",
                createdAt: "2026-07-23T16:00:00.000Z",
                updatedAt: "2026-07-23T16:00:00.000Z",
                user: { username: "alice" },
              },
            ]}
            onDeleteNote={onDeleteNote}
            onUpdateNote={onUpdateNote}
          />
        </TestProviders>
      );
    });

    await act(async () =>
      user.click(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>("button")
        ).find((button) => button.textContent === "Delete")!
      )
    );
    await act(async () =>
      user.click(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>("button")
        ).find((button) => button.textContent === "Delete")!
      )
    );

    expect(onDeleteNote).toHaveBeenCalledWith("note-1");
  });

  it("replaces the note body and actions with an inline editor", async () => {
    const user = userEvent.setup();
    act(() => {
      root.render(
        <TestProviders>
          <SpanNotesListContent
            notes={[
              {
                id: "note-1",
                explanation: "First observation",
                createdAt: "2026-07-23T16:00:00.000Z",
                updatedAt: "2026-07-23T16:00:00.000Z",
                user: { username: "alice" },
              },
            ]}
            onDeleteNote={onDeleteNote}
            onUpdateNote={onUpdateNote}
          />
        </TestProviders>
      );
    });

    await act(async () =>
      user.click(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>("button")
        ).find((button) => button.textContent === "Edit")!
      )
    );

    const editor = container.querySelector<HTMLElement>(".span-note__editor");
    const textarea = editor?.querySelector<HTMLTextAreaElement>("textarea");
    const frame = container.querySelector<HTMLElement>(
      "[data-span-note-frame]"
    );
    expect(textarea?.value).toBe("First observation");
    expect(frame?.getAttribute("data-framed")).toBe("true");
    expect(frame?.style.padding).toBe("var(--global-dimension-size-200)");
    expect(document.activeElement).toBe(textarea);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "nearest",
      inline: "nearest",
    });
    expect(scrollIntoView.mock.instances[0]).toBe(frame);
    const actions = container.querySelector<HTMLElement>(".span-note__actions");
    expect(getComputedStyle(frame!).scrollMarginBlockEnd).toBe(
      "var(--global-dimension-size-200)"
    );
    expect(getComputedStyle(frame?.firstElementChild!).gap).toBe(
      "var(--global-dimension-size-200)"
    );
    expect(getComputedStyle(actions!).gap).toBe(
      "var(--global-dimension-size-100)"
    );
    expect(container.querySelector(".span-note__text")).toBeNull();
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "Edit"
      )
    ).toBe(false);
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "Delete"
      )
    ).toBe(false);
    expect(container.textContent).toContain("alice");
    expect(
      Array.from(container.querySelectorAll<HTMLButtonElement>("button")).map(
        (button) => button.textContent
      )
    ).toEqual(["Cancel", "Save"]);

    await act(async () => {
      await user.clear(textarea!);
      await user.type(textarea!, "Discarded observation");
      await user.click(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>("button")
        ).find((button) => button.textContent === "Cancel")!
      );
    });

    expect(onUpdateNote).not.toHaveBeenCalled();
    expect(container.querySelector(".span-note__editor")).toBeNull();
    expect(container.querySelector(".span-note__text")?.textContent).toBe(
      "First observation"
    );

    await act(async () =>
      user.click(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>("button")
        ).find((button) => button.textContent === "Edit")!
      )
    );

    const reopenedTextarea = container.querySelector<HTMLTextAreaElement>(
      ".span-note__editor textarea"
    );
    expect(reopenedTextarea?.value).toBe("First observation");

    await act(async () => {
      await user.clear(reopenedTextarea!);
      await user.type(reopenedTextarea!, "Updated observation");
      await user.click(
        Array.from(
          container.querySelectorAll<HTMLButtonElement>("button")
        ).find((button) => button.textContent === "Save")!
      );
    });

    expect(onUpdateNote).toHaveBeenCalledWith({
      noteId: "note-1",
      noteText: "Updated observation",
    });
    expect(container.querySelector(".span-note__editor")).toBeNull();
  });

  it("shows the last edit date and reveals the creation date on hover", async () => {
    const user = userEvent.setup();
    act(() => {
      root.render(
        <TestProviders>
          <SpanNotesListContent
            notes={[
              {
                id: "note-1",
                explanation: "Updated observation",
                createdAt: "2026-07-23T16:00:00.000Z",
                updatedAt: "2026-07-24T18:30:00.000Z",
                user: { username: "alice" },
              },
            ]}
            onDeleteNote={onDeleteNote}
            onUpdateNote={onUpdateNote}
          />
        </TestProviders>
      );
    });

    const editedTime = container.querySelector("time");
    expect(editedTime?.getAttribute("dateTime")).toBe(
      "2026-07-24T18:30:00.000Z"
    );
    expect(editedTime?.textContent).toMatch(/Jul 24, 2026, .* Edited$/);

    await act(async () => user.hover(editedTime!));

    expect(document.body.textContent).toMatch(
      /Created at Jul 23, 2026, \d{1,2}:\d{2} [AP]M/
    );
  });
});
