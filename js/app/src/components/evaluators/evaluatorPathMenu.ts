import type {
  Completion,
  CompletionInfo,
  CompletionResult,
} from "@codemirror/autocomplete";
import {
  acceptCompletion,
  autocompletion,
  closeCompletion,
  completionStatus,
  currentCompletions,
  selectedCompletion,
  selectedCompletionIndex,
  setSelectedCompletion,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import type { EditorView, Rect } from "@codemirror/view";
import { keymap } from "@codemirror/view";

import { CHEVRON_RIGHT_SMALL_PATH } from "@phoenix/components/core/icon/chevronRightSmallPath";
import { toTypeaheadCompletionClass } from "@phoenix/components/filter/styles";

import type {
  EvaluatorPathCompletion,
  EvaluatorPathCount,
} from "./evaluatorPathCompletions";
import { writeEvaluatorPathCompletion } from "./evaluatorPathCompletions";

/** A path-field menu row, carrying what its badge and side panel show. */
export type EvaluatorPathMenuCompletion = Completion & {
  count?: EvaluatorPathCount;
  drills?: boolean;
};

/**
 * How long the pointer rests on a row before its side panel opens. Long
 * enough that crossing rows on the way to an open panel leaves it open.
 */
const HOVER_SELECT_DELAY_MS = 120;

/** The gap between the menu and its side panel. */
const PANEL_GAP_PX = 4;

/**
 * How far a panel sits above its row: its border plus its padding, so its
 * first row lines up with the row that opened it.
 */
const PANEL_INSET_PX = 5;

const PANEL_MAX_WIDTH_PX = 400;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** A nested panel set on the left of the panel that opened it. */
const LEFT_PANEL_CLASS = "evaluator-path-panel--left";

/**
 * The menu chrome only the path field has: a count badge and a submenu
 * chevron on a container row, a side panel that opens on the row the pointer
 * rests on, ArrowRight into what a highlighted row holds, and a menu that
 * opens above the field.
 */
export function evaluatorPathMenu(): Extension {
  return [
    autocompletion({
      addToOptions: [
        { render: renderCountBadge, position: 90 },
        { render: renderSubmenuChevron, position: 95 },
        { render: renderHoverTarget, position: 100 },
      ],
      positionInfo: positionPathPanel,
      // Each time the menu opens it picks a side afresh, so starting below
      // has it bounce over the field as its row count changes with what is
      // typed. Starting above keeps it there unless there is no room.
      aboveCursor: true,
    }),
    Prec.high(keymap.of([{ key: "ArrowRight", run: drillIntoSelected }])),
  ];
}

/**
 * Matched ranges for a row that shows something other than its label. A
 * name shown without the home it shares keeps its highlight, shifted onto
 * what is shown; prose matches nothing, since it was not what was typed.
 */
export const matchDisplayedKey: NonNullable<CompletionResult["getMatch"]> = (
  completion,
  matched
) => {
  const shown = completion.displayLabel;
  if (shown === undefined) {
    return matched ?? [];
  }
  if (matched === undefined || !completion.label.endsWith(shown)) {
    return [];
  }
  const offset = completion.label.length - shown.length;
  const ranges: number[] = [];
  for (let index = 0; index + 1 < matched.length; index += 2) {
    const to = matched[index + 1] - offset;
    if (to > 0) {
      ranges.push(Math.max(0, matched[index] - offset), to);
    }
  }
  return ranges;
};

/** The rows one level below a path, as a side panel offers them. */
export type EvaluatorPathSubmenuRows = (
  path: string
) => readonly EvaluatorPathCompletion[];

/**
 * The side panel beside a row that holds more: the level accepting the row
 * would open, each row of it writing its own path when clicked. A row in it
 * that holds more opens the level below it the same way, beside the panel,
 * so a nested record can be browsed as deep as it goes.
 */
export function renderSubmenuPanel({
  view,
  path,
  note,
  getRows,
}: {
  view: EditorView;
  path: string;
  note?: string;
  getRows: EvaluatorPathSubmenuRows;
}): CompletionInfo {
  return createSubmenuPanel({ view, path, note, getRows });
}

function createSubmenuPanel({
  view,
  path,
  note,
  getRows,
}: {
  view: EditorView;
  path: string;
  note?: string;
  getRows: EvaluatorPathSubmenuRows;
}): HTMLElement {
  const panel = createElement("div", "evaluator-path-panel");
  if (note) {
    panel.append(createElement("div", "evaluator-path-panel__note", note));
  }
  const list = createElement("ul", "evaluator-path-panel__rows");
  // The level below one row of this panel, while the pointer rests there.
  let open: { row: HTMLElement; panel: HTMLElement } | null = null;
  const closeNested = () => {
    open?.row.removeAttribute("data-open");
    open?.panel.remove();
    open = null;
  };
  const openNested = (item: HTMLElement, row: EvaluatorPathCompletion) => {
    if (open?.row === item) {
      return;
    }
    closeNested();
    if (!row.drills) {
      return;
    }
    const nested = createSubmenuPanel({
      view,
      path: row.path,
      note: row.note,
      getRows,
    });
    nested.classList.add("evaluator-path-panel--nested");
    item.setAttribute("data-open", "");
    panel.append(nested);
    placeNestedPanel({ panel, item, nested });
    open = { row: item, panel: nested };
  };
  for (const row of getRows(path)) {
    const item = renderSubmenuRow({ view, row });
    let timer: number | undefined;
    item.addEventListener("mouseenter", () => {
      timer = window.setTimeout(
        () => openNested(item, row),
        HOVER_SELECT_DELAY_MS
      );
    });
    item.addEventListener("mouseleave", () => window.clearTimeout(timer));
    list.append(item);
  }
  // Scrolling moves the rows out from under an open level, so it closes.
  list.addEventListener("scroll", closeNested);
  panel.append(list);
  return panel;
}

/**
 * Sets a nested panel beside the row that opened it, its first row level with
 * that row, and kept on screen. A cascade keeps going the way it started, so a
 * level opened from a panel that had to sit left of the menu opens leftward
 * too, rather than back over the panels before it; it turns only where that
 * side has no room.
 */
function placeNestedPanel({
  panel,
  item,
  nested,
}: {
  panel: HTMLElement;
  item: HTMLElement;
  nested: HTMLElement;
}) {
  const panelRect = panel.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  nested.style.top = `${itemRect.top - panelRect.top - PANEL_INSET_PX}px`;
  const width = nested.getBoundingClientRect().width;
  const fitsRight = panelRect.right + width + PANEL_GAP_PX <= window.innerWidth;
  const fitsLeft = panelRect.left - width - PANEL_GAP_PX >= 0;
  const wentLeft =
    panel.classList.contains(LEFT_PANEL_CLASS) ||
    panel.closest(".cm-completionInfo-left") !== null;
  if (wentLeft ? fitsLeft || !fitsRight : !fitsRight && fitsLeft) {
    nested.classList.add(LEFT_PANEL_CLASS);
  }
  const overflow = nested.getBoundingClientRect().bottom - window.innerHeight;
  if (overflow > 0) {
    const top = Number.parseFloat(nested.style.top);
    nested.style.top = `${Math.max(top - overflow, -panelRect.top)}px`;
  }
}

/** The side panel beside a row that reads a value: a longer preview of it. */
export function renderPreviewPanel({
  preview,
  note,
}: {
  preview?: string;
  note?: string;
}): CompletionInfo {
  const panel = createElement("div", "evaluator-path-panel");
  if (note) {
    panel.append(createElement("div", "evaluator-path-panel__note", note));
  }
  if (preview) {
    panel.append(
      createElement("div", "evaluator-path-panel__preview", preview)
    );
  }
  return panel;
}

function renderSubmenuRow({
  view,
  row,
}: {
  view: EditorView;
  row: EvaluatorPathCompletion;
}): HTMLElement {
  // No id: the menu accepts a pressed `li` by the index its id ends in, and
  // this row is not one of the menu's own.
  const item = createElement("li", toTypeaheadCompletionClass(row.type ?? ""));
  item.append(
    createElement("span", "cm-completionLabel", row.displayKey ?? row.key)
  );
  if (row.detail) {
    item.append(createElement("span", "cm-completionDetail", row.detail));
  }
  if (row.count) {
    item.append(createCountBadge(row.count));
  }
  if (row.drills) {
    item.append(createSubmenuChevron());
  }
  // Pressing keeps focus in the editor, so the menu stays open behind it.
  item.addEventListener("mousedown", (event) => event.preventDefault());
  item.addEventListener("click", (event) => {
    // A nested panel sits inside this one, so its click must not also be
    // taken as a click on the row that opened it.
    event.stopPropagation();
    writeEvaluatorPathCompletion({
      view,
      completion: row,
      to: view.state.doc.length,
    });
    if (!row.drills) {
      closeCompletion(view);
    }
  });
  return item;
}

function renderSubmenuChevron(completion: Completion): Node | null {
  return (completion as EvaluatorPathMenuCompletion).drills
    ? createSubmenuChevron()
    : null;
}

/**
 * The chevron a row with more inside it ends in — the glyph and size the app's
 * own menus give an item with a submenu.
 */
function createSubmenuChevron(): HTMLElement {
  const wrap = createElement("i", "icon-wrap typeahead-completion-chevron");
  wrap.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  const outline = document.createElementNS(SVG_NAMESPACE, "path");
  outline.setAttribute("d", CHEVRON_RIGHT_SMALL_PATH);
  svg.append(outline);
  wrap.append(svg);
  return wrap;
}

function renderCountBadge(completion: Completion): Node | null {
  const { count } = completion as EvaluatorPathMenuCompletion;
  return count ? createCountBadge(count) : null;
}

function createCountBadge(count: EvaluatorPathCount): HTMLElement {
  const badge = createElement(
    "span",
    "typeahead-completion-count",
    `${count.value}`
  );
  const label = `${count.value} ${count.noun}${count.value === 1 ? "" : "s"}`;
  badge.title = label;
  badge.setAttribute("aria-label", label);
  return badge;
}

/**
 * A layer over the row that highlights it once the pointer rests there, which
 * is what opens its side panel. Presses pass through to the row beneath.
 */
function renderHoverTarget(
  completion: Completion,
  _state: unknown,
  view: EditorView
): Node {
  const target = createElement("span", "evaluator-path-hover-target");
  target.setAttribute("aria-hidden", "true");
  let timer: number | undefined;
  target.addEventListener("mouseenter", () => {
    timer = window.setTimeout(() => {
      const index = currentCompletions(view.state).indexOf(completion);
      if (index >= 0 && index !== selectedCompletionIndex(view.state)) {
        view.dispatch({ effects: setSelectedCompletion(index) });
      }
    }, HOVER_SELECT_DELAY_MS);
  });
  target.addEventListener("mouseleave", () => window.clearTimeout(timer));
  return target;
}

/**
 * ArrowRight opens what the highlighted row holds, as a submenu would. Only at
 * the end of the path, where the key would otherwise move nothing.
 */
function drillIntoSelected(view: EditorView): boolean {
  if (completionStatus(view.state) !== "active") {
    return false;
  }
  const selected = selectedCompletion(
    view.state
  ) as EvaluatorPathMenuCompletion | null;
  const { empty, head } = view.state.selection.main;
  if (!selected?.drills || !empty || head !== view.state.doc.length) {
    return false;
  }
  return acceptCompletion(view);
}

/**
 * Places the side panel the way a submenu sits: beside the menu, its first
 * row level with the row that opened it, on whichever side has room. With
 * room on neither side it drops below the whole menu rather than cover it.
 */
function positionPathPanel(
  _view: EditorView,
  list: Rect,
  option: Rect,
  info: Rect,
  space: Rect,
  // Passed at runtime though the published type leaves it out; it is what
  // undoes a scaled menu's transform.
  tooltip?: HTMLElement
): { style?: string; class?: string } {
  const infoWidth = info.right - info.left;
  const infoHeight = info.bottom - info.top;
  const spaceRight = space.right - list.right - PANEL_GAP_PX;
  const spaceLeft = list.left - space.left - PANEL_GAP_PX;
  const scaleX = tooltip
    ? (list.right - list.left) / tooltip.offsetWidth || 1
    : 1;
  const scaleY = tooltip
    ? (list.bottom - list.top) / tooltip.offsetHeight || 1
    : 1;
  const side =
    infoWidth <= spaceRight ? "right" : infoWidth <= spaceLeft ? "left" : null;
  if (side !== null) {
    const top =
      Math.max(
        space.top,
        Math.min(option.top - PANEL_INSET_PX, space.bottom - infoHeight)
      ) - list.top;
    const maxWidth = Math.min(
      PANEL_MAX_WIDTH_PX,
      side === "right" ? spaceRight : spaceLeft
    );
    return {
      style: `top: ${top / scaleY}px; max-width: ${maxWidth / scaleX}px; margin-${side === "right" ? "left" : "right"}: ${PANEL_GAP_PX}px`,
      class: `cm-completionInfo-${side}`,
    };
  }
  const maxWidth = Math.min(PANEL_MAX_WIDTH_PX, space.right - list.left);
  return {
    style: `top: ${(list.bottom - list.top + PANEL_GAP_PX) / scaleY}px; left: 0; max-width: ${maxWidth / scaleX}px`,
    class: "cm-completionInfo-below",
  };
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}
