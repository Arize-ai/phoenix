import {
  autocompletion,
  completionStatus,
  setSelectedCompletion,
  startCompletion,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeCompletionOnEscape } from "../completionKeys";
import type { EvaluatorPathCompletion } from "../evaluatorPathCompletions";
import { evaluatorPathFieldKeys } from "../evaluatorPathFieldKeys";
import {
  evaluatorPathPanelNavigation,
  renderSubmenuPanel,
} from "../evaluatorPathPanel";

const SECTION = { name: "level", rank: 0 };

/** A record three objects deep: `a` holds `b`, which holds `c`. */
const ROWS_BY_PATH: Record<string, EvaluatorPathCompletion[]> = {
  a: [
    { key: "b", path: "a.b", detail: "", section: SECTION, drills: true },
    { key: "x", path: "a.x", detail: "1", section: SECTION },
  ],
  "a.b": [
    { key: "c", path: "a.b.c", detail: "", section: SECTION, drills: true },
  ],
  "a.b.c": [{ key: "d", path: "a.b.c.d", detail: "2", section: SECTION }],
};

const getRows = (path: string) => ROWS_BY_PATH[path] ?? [];

describe("the path field's side panel", () => {
  let view: EditorView;
  let parent: HTMLElement;
  const reachedParent: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    parent = document.createElement("div");
    document.body.append(parent);
    // Only Escape is kept from leaving; the other keys bubble on, handled.
    parent.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        reachedParent.push(event.key);
      }
    });
  });
  afterEach(() => {
    view.destroy();
    parent.remove();
    reachedParent.length = 0;
    vi.useRealTimers();
  });

  /**
   * An editor holding `a`, its caret at the end unless said otherwise, with
   * the panel's keys unless the test composes the field's own.
   */
  const createView = ({
    extensions = evaluatorPathPanelNavigation(),
    doc = "a",
    caret = doc.length,
  }: {
    extensions?: Extension;
    doc?: string;
    caret?: number;
  } = {}) => {
    view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: caret },
        extensions,
      }),
      parent,
    });
    return view;
  };
  /** The panel beside the menu's row for `a`, as the menu would show it. */
  const mountPanel = () => {
    const info = renderSubmenuPanel({ view, path: "a", getRows });
    if (info === null || !("dom" in info)) {
      throw new Error("expected a panel with a destroy hook");
    }
    document.body.append(info.dom);
    return info.dom as HTMLElement;
  };
  const press = (key: string) =>
    view.contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  const rowsOf = (panel: Element) => [
    ...panel.querySelectorAll(":scope > ul > li"),
  ];
  const labelsOf = (panel: Element) =>
    rowsOf(panel).map(
      (row) => row.querySelector(".cm-completionLabel")?.textContent
    );
  const nestedOf = (panel: Element) =>
    panel.querySelector(":scope > .evaluator-path-panel--nested");
  /** The label of the row the keyboard rests on in this level alone. */
  const activeOf = (panel: Element) =>
    panel
      .querySelector(':scope > ul > li[aria-selected="true"]')
      ?.querySelector(".cm-completionLabel")?.textContent ?? null;
  const hover = (row: Element) => {
    row.dispatchEvent(new MouseEvent("mouseenter"));
    vi.advanceTimersByTime(200);
  };

  it("ends a row that holds more in a chevron that reads as a submenu", () => {
    createView();
    const [holdsMore, value] = rowsOf(mountPanel());

    expect(holdsMore.querySelector(".typeahead-completion-chevron")).not.toBe(
      null
    );
    expect(holdsMore.textContent).toContain("submenu");
    expect(value.querySelector(".typeahead-completion-chevron")).toBe(null);
  });

  // Each level opens the next beside it, so a record can be browsed as deep
  // as it nests.
  it("opens a level below each row the pointer rests on, as deep as it goes", () => {
    createView();
    const panel = mountPanel();
    hover(rowsOf(panel)[0]);
    const second = nestedOf(panel);
    expect(second).not.toBe(null);
    expect(labelsOf(second!)).toEqual(["c"]);
    expect(rowsOf(panel)[0].hasAttribute("data-open")).toBe(true);

    hover(rowsOf(second!)[0]);
    const third = nestedOf(second!);
    expect(labelsOf(third!)).toEqual(["d"]);
  });

  it("closes an open level when the pointer rests on another row", () => {
    createView();
    const panel = mountPanel();
    hover(rowsOf(panel)[0]);
    hover(rowsOf(panel)[1]);

    expect(nestedOf(panel)).toBe(null);
    expect(rowsOf(panel)[0].hasAttribute("data-open")).toBe(false);
  });

  it("keeps a level open when the pointer only passes over another row", () => {
    createView();
    const panel = mountPanel();
    hover(rowsOf(panel)[0]);
    const passed = rowsOf(panel)[1];
    passed.dispatchEvent(new MouseEvent("mouseenter"));
    vi.advanceTimersByTime(50);
    passed.dispatchEvent(new MouseEvent("mouseleave"));
    vi.advanceTimersByTime(200);

    expect(nestedOf(panel)).not.toBe(null);
  });

  it("steps into the panel on ArrowRight at the end of the path, and says so to a screen reader", () => {
    createView();
    const panel = mountPanel();
    press("ArrowRight");

    expect(activeOf(panel)).toBe("b");
    const active = panel.querySelector(
      ':scope > ul > li[aria-selected="true"]'
    )!;
    expect(view.contentDOM.getAttribute("aria-activedescendant")).toBe(
      active.id
    );
    expect(view.contentDOM.getAttribute("aria-owns")).toBe(
      active.parentElement!.id
    );
    expect(active.parentElement!.getAttribute("role")).toBe("listbox");
    expect(active.getAttribute("role")).toBe("option");
    // What the row holds shows beside it, as it does under the pointer.
    expect(labelsOf(nestedOf(panel)!)).toEqual(["c"]);
  });

  it("leaves ArrowRight to the caret while it is inside the path", () => {
    createView({ doc: "ab", caret: 1 });
    const panel = mountPanel();
    press("ArrowRight");

    expect(activeOf(panel)).toBe(null);
    expect(view.contentDOM.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("walks a level with the arrow keys, wrapping at either end, and jumps with Home and End", () => {
    createView();
    const panel = mountPanel();
    press("ArrowRight");
    press("ArrowDown");
    expect(activeOf(panel)).toBe("x");
    press("ArrowDown");
    expect(activeOf(panel)).toBe("b");
    press("ArrowUp");
    expect(activeOf(panel)).toBe("x");
    press("Home");
    expect(activeOf(panel)).toBe("b");
    press("End");
    expect(activeOf(panel)).toBe("x");
  });

  it("steps into the level a row holds, and back out to the row, which keeps its level open", () => {
    createView();
    const panel = mountPanel();
    press("ArrowRight");
    press("ArrowRight");
    const second = nestedOf(panel)!;
    expect(activeOf(panel)).toBe(null);
    expect(activeOf(second)).toBe("c");
    expect(rowsOf(panel)[0].hasAttribute("data-open")).toBe(true);
    expect(view.contentDOM.getAttribute("aria-owns")).toBe(
      second.querySelector("ul")!.id
    );

    press("ArrowLeft");
    expect(activeOf(panel)).toBe("b");
    expect(nestedOf(panel)).not.toBe(null);
    expect(activeOf(nestedOf(panel)!)).toBe(null);
  });

  it("stays on a row that holds nothing more on ArrowRight", () => {
    createView();
    const panel = mountPanel();
    press("ArrowRight");
    press("ArrowDown");
    press("ArrowRight");

    expect(activeOf(panel)).toBe("x");
    expect(nestedOf(panel)).toBe(null);
  });

  it("backs out one level on Escape and stops there; with the keyboard on the menu the key passes through", () => {
    createView({
      extensions: [evaluatorPathPanelNavigation(), closeCompletionOnEscape],
    });
    const panel = mountPanel();
    press("ArrowRight");
    press("ArrowRight");
    press("Escape");
    expect(activeOf(panel)).toBe("b");
    expect(reachedParent).toEqual([]);

    press("Escape");
    expect(activeOf(panel)).toBe(null);
    expect(reachedParent).toEqual([]);

    press("Escape");
    expect(reachedParent).toEqual(["Escape"]);
  });

  it("writes the path of the row the keyboard is on with Enter", () => {
    createView();
    mountPanel();
    press("ArrowRight");
    press("ArrowDown");
    press("Enter");

    expect(view.state.doc.toString()).toBe("a.x");
  });

  it("lets go of the panel once the path is edited", () => {
    createView();
    const panel = mountPanel();
    press("ArrowRight");
    view.dispatch({ changes: { from: 1, insert: "." } });

    expect(activeOf(panel)).toBe(null);
    expect(view.contentDOM.hasAttribute("aria-activedescendant")).toBe(false);
  });

  // Composed as the field composes them, with the editor's own completion
  // keymap ahead of the menu's keys, as the field mounts it.
  it("takes the arrows and the active descendant over from the menu while in the panel, and gives them back when the menu's highlight moves", async () => {
    createView({
      extensions: [
        autocompletion({
          override: [
            () => ({
              from: 0,
              options: [
                {
                  label: "a",
                  info: () => renderSubmenuPanel({ view, path: "a", getRows }),
                },
                { label: "ab" },
              ],
            }),
          ],
        }),
        evaluatorPathFieldKeys,
      ],
    });
    startCompletion(view);
    await vi.advanceTimersByTimeAsync(100);
    expect(completionStatus(view.state)).toBe("active");
    const menuRow = view.contentDOM.getAttribute("aria-activedescendant");
    expect(menuRow).toMatch(/^cm-ac-/);
    const menuSelected = () =>
      document.querySelector(
        ".cm-tooltip-autocomplete > ul > li[aria-selected]"
      )?.textContent;
    expect(menuSelected()).toBe("a");
    const panel = document.querySelector(
      ".cm-completionInfo .evaluator-path-panel"
    );
    expect(panel).not.toBe(null);

    press("ArrowRight");
    expect(activeOf(panel!)).toBe("b");
    expect(view.contentDOM.getAttribute("aria-activedescendant")).toMatch(
      /^evaluator-path-panel-/
    );

    press("ArrowDown");
    expect(activeOf(panel!)).toBe("x");
    expect(menuSelected()).toBe("a");

    press("Escape");
    expect(activeOf(panel!)).toBe(null);
    expect(completionStatus(view.state)).toBe("active");

    press("ArrowRight");
    view.dispatch({ effects: setSelectedCompletion(1) });
    expect(view.contentDOM.getAttribute("aria-activedescendant")).toMatch(
      /^cm-ac-/
    );
    expect(view.contentDOM.hasAttribute("aria-owns")).toBe(false);
  });
});
