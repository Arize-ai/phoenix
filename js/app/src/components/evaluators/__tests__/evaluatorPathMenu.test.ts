import type { EditorView } from "@codemirror/view";

import type { EvaluatorPathCompletion } from "../evaluatorPathCompletions";
import { matchDisplayedKey, renderSubmenuPanel } from "../evaluatorPathMenu";

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

describe("matchDisplayedKey", () => {
  it("keeps the matches of a row shown as its label", () => {
    expect(matchDisplayedKey({ label: "input" }, [0, 2])).toEqual([0, 2]);
  });

  // `metadata.latency_ms` shows as `latency_ms`, so typing `lat` highlights
  // the start of what is shown.
  it("shifts matches onto a name shown without its home", () => {
    expect(
      matchDisplayedKey(
        { label: "metadata.latency_ms", displayLabel: "latency_ms" },
        [9, 12]
      )
    ).toEqual([0, 3]);
  });

  it("drops a match that falls in the home left off", () => {
    expect(
      matchDisplayedKey(
        { label: "metadata.latency_ms", displayLabel: "latency_ms" },
        [0, 3, 9, 12]
      )
    ).toEqual([0, 3]);
  });

  it("highlights nothing on a row shown as prose", () => {
    expect(
      matchDisplayedKey(
        { label: "input.messages[-1].content", displayLabel: "Last message" },
        [0, 5]
      )
    ).toEqual([]);
  });
});

describe("renderSubmenuPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const renderPanel = () => {
    const panel = renderSubmenuPanel({
      view: {} as EditorView,
      path: "a",
      getRows: (path) => ROWS_BY_PATH[path] ?? [],
    }) as HTMLElement;
    document.body.append(panel);
    return panel;
  };
  const rowsOf = (panel: Element) => [
    ...panel.querySelectorAll(":scope > ul > li"),
  ];
  const hover = (row: Element) => {
    row.dispatchEvent(new MouseEvent("mouseenter"));
    vi.advanceTimersByTime(200);
  };

  it("ends a row that holds more in a chevron", () => {
    const [holdsMore, value] = rowsOf(renderPanel());

    expect(holdsMore.querySelector(".typeahead-completion-chevron")).not.toBe(
      null
    );
    expect(value.querySelector(".typeahead-completion-chevron")).toBe(null);
  });

  // Each level opens the next beside it, so a record can be browsed as deep
  // as it nests.
  it("opens a level below each row the pointer rests on, as deep as it goes", () => {
    const panel = renderPanel();
    hover(rowsOf(panel)[0]);
    const second = panel.querySelector(
      ":scope > .evaluator-path-panel--nested"
    );
    expect(second).not.toBe(null);
    expect(rowsOf(second!).map((row) => row.textContent)).toEqual(["c"]);
    expect(rowsOf(panel)[0].hasAttribute("data-open")).toBe(true);

    hover(rowsOf(second!)[0]);
    const third = second!.querySelector(
      ":scope > .evaluator-path-panel--nested"
    );
    expect(rowsOf(third!).map((row) => row.textContent)).toEqual(["d2"]);
  });

  it("closes an open level when the pointer rests on another row", () => {
    const panel = renderPanel();
    hover(rowsOf(panel)[0]);
    hover(rowsOf(panel)[1]);

    expect(panel.querySelector(".evaluator-path-panel--nested")).toBe(null);
    expect(rowsOf(panel)[0].hasAttribute("data-open")).toBe(false);
  });

  it("keeps a level open when the pointer only passes over another row", () => {
    const panel = renderPanel();
    hover(rowsOf(panel)[0]);
    const passed = rowsOf(panel)[1];
    passed.dispatchEvent(new MouseEvent("mouseenter"));
    vi.advanceTimersByTime(50);
    passed.dispatchEvent(new MouseEvent("mouseleave"));
    vi.advanceTimersByTime(200);

    expect(panel.querySelector(".evaluator-path-panel--nested")).not.toBe(null);
  });
});
