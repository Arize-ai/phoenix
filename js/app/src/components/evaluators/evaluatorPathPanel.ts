import type { CompletionInfo } from "@codemirror/autocomplete";
import {
  closeCompletion,
  completionStatus,
  selectedCompletion,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import { Prec, StateEffect, StateField } from "@codemirror/state";
import type { Command, ViewUpdate } from "@codemirror/view";
import { EditorView, ViewPlugin } from "@codemirror/view";

import { toTypeaheadCompletionClass } from "@phoenix/components/filter/styles";

import type { EvaluatorPathCompletion } from "./evaluatorPathCompletions";
import { writeEvaluatorPathCompletion } from "./evaluatorPathCompletions";
import {
  createCountBadge,
  createElement,
  createSubmenuChevron,
  HOVER_SELECT_DELAY_MS,
  PANEL_GAP_PX,
  PANEL_INSET_PX,
} from "./evaluatorPathMenuChrome";

/** The rows one level below a path, as a side panel offers them. */
export type EvaluatorPathSubmenuRows = (
  path: string
) => readonly EvaluatorPathCompletion[];

/**
 * Where the keyboard rests in the cascade of side panels: the row it is on
 * at each open level, the panel beside the menu first. Empty while it is
 * still on the menu's own rows.
 */
export type EvaluatorPathPanelCursor = readonly number[];

const NO_CURSOR: EvaluatorPathPanelCursor = [];

const setPanelCursor = StateEffect.define<EvaluatorPathPanelCursor>();

/**
 * The cursor lives in editor state so that the keys, the pointer and the
 * editor's ARIA attributes all read the same place. It is cleared whenever
 * the panel it points into is gone: the menu's highlight moved, the menu
 * closed, or the path was edited.
 */
const panelCursorField = StateField.define<EvaluatorPathPanelCursor>({
  create: () => NO_CURSOR,
  update(cursor, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setPanelCursor)) {
        return effect.value;
      }
    }
    if (cursor.length === 0) {
      return cursor;
    }
    if (
      tr.docChanged ||
      completionStatus(tr.state) !== "active" ||
      selectedCompletion(tr.state) !== selectedCompletion(tr.startState)
    ) {
      return NO_CURSOR;
    }
    return cursor;
  },
});

/** A nested panel set on the left of the panel that opened it. */
const LEFT_PANEL_CLASS = "evaluator-path-panel--left";

/** The panel beside the menu's highlighted row, for each editor showing one. */
const rootPanels = new WeakMap<EditorView, PanelLevel>();

let panelCount = 0;

/**
 * The side panel beside a row that holds more: the level accepting the row
 * would open, each row of it writing its own path when picked. A row in it
 * that holds more opens the level below it the same way, beside the panel,
 * so a nested record can be browsed as deep as it goes — with the pointer,
 * or with the keys the app's own submenus answer to.
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
  const root = new PanelLevel({
    view,
    path,
    note,
    getRows,
    id: `evaluator-path-panel-${++panelCount}`,
    prefix: NO_CURSOR,
  });
  rootPanels.set(view, root);
  return {
    dom: root.dom,
    destroy: () => {
      root.destroy();
      if (rootPanels.get(view) === root) {
        rootPanels.delete(view);
      }
    },
  };
}

/**
 * The keys that walk the cascade, as a submenu takes them: ArrowRight into
 * the level beside the highlighted row, ArrowUp and ArrowDown along it,
 * ArrowLeft or Escape back out, Enter or Tab to write the row's path. Each
 * stands aside while the keyboard is on the menu's own rows, except
 * ArrowRight at the end of the path, which is what steps in.
 */
export function evaluatorPathPanelNavigation(): Extension {
  return [panelCursorField, syncPanels, panelActiveDescendant, panelKeys];
}

const PANEL_COMMANDS: Record<string, Command> = {
  ArrowRight: (view) => enterPanelLevel(view),
  ArrowLeft: (view) => leavePanelLevel(view),
  ArrowDown: (view) => movePanelCursor(view, 1),
  ArrowUp: (view) => movePanelCursor(view, -1),
  Home: (view) => movePanelCursorToEdge(view, "first"),
  End: (view) => movePanelCursorToEdge(view, "last"),
  Enter: (view) => acceptPanelRow(view),
  Tab: (view) => acceptPanelRow(view),
  Escape: (view) => leavePanelLevel(view),
};

/**
 * Taken straight from the keydown event rather than through a keymap: every
 * keymap runs inside one handler of default precedence, in an order the
 * field's own completion keymap can win, while a handler of the highest
 * precedence runs before all of them — and before `closeCompletionOnEscape`,
 * so Escape backs out of a level before it can close the whole menu. A key
 * the panel takes goes no further, which keeps Escape from the dialog.
 */
const panelKeys = Prec.highest(
  EditorView.domEventHandlers({
    keydown(event, view) {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.isComposing
      ) {
        return false;
      }
      const command = PANEL_COMMANDS[event.key];
      if (command === undefined || !command(view)) {
        return false;
      }
      event.stopPropagation();
      return true;
    },
  })
);

/** Keeps the mounted panels showing where the cursor is. */
const syncPanels = ViewPlugin.define(() => ({
  update(update: ViewUpdate) {
    const cursor = update.state.field(panelCursorField);
    if (cursor !== update.startState.field(panelCursorField)) {
      rootPanels.get(update.view)?.sync(cursor);
    }
  },
}));

/**
 * While the keyboard is in a panel, the editor says so: its active
 * descendant is the panel row rather than the menu's, and it owns the level
 * that row is in, which sits outside the list it controls. Highest
 * precedence so it is read before the menu's own attributes.
 */
const panelActiveDescendant = Prec.highest(
  EditorView.contentAttributes.of((view) => {
    const cursor = view.state.field(panelCursorField, false) ?? NO_CURSOR;
    const root = rootPanels.get(view);
    if (cursor.length === 0 || root === undefined) {
      return null;
    }
    return {
      "aria-activedescendant": root.rowId(cursor),
      "aria-owns": root.listId(cursor.slice(0, -1)),
    };
  })
);

function cursorOf(view: EditorView): EvaluatorPathPanelCursor {
  return view.state.field(panelCursorField, false) ?? NO_CURSOR;
}

/**
 * Steps into the level beside the highlighted row, or from a panel row into
 * the level below it. From the menu, only at the end of the path, where the
 * key would otherwise move nothing.
 */
export const enterPanelLevel: Command = (view) => {
  const root = rootPanels.get(view);
  if (root === undefined) {
    return false;
  }
  const cursor = cursorOf(view);
  if (cursor.length === 0) {
    const { empty, head } = view.state.selection.main;
    if (!empty || head !== view.state.doc.length) {
      return false;
    }
    if (root.size > 0) {
      view.dispatch({ effects: setPanelCursor.of([0]) });
    }
    return true;
  }
  const below = root.levelAt(cursor);
  if (below !== null && below.size > 0) {
    view.dispatch({ effects: setPanelCursor.of([...cursor, 0]) });
  }
  return true;
};

/** Steps back out to the row that opened the level the cursor is in. */
export const leavePanelLevel: Command = (view) => {
  const cursor = cursorOf(view);
  if (cursor.length === 0) {
    return false;
  }
  view.dispatch({ effects: setPanelCursor.of(cursor.slice(0, -1)) });
  return true;
};

function movePanelCursor(view: EditorView, step: 1 | -1): boolean {
  const cursor = cursorOf(view);
  const level = rootPanels.get(view)?.levelAt(cursor.slice(0, -1));
  if (cursor.length === 0 || !level) {
    return false;
  }
  const last = cursor[cursor.length - 1];
  const next = (last + step + level.size) % level.size;
  view.dispatch({ effects: setPanelCursor.of([...cursor.slice(0, -1), next]) });
  return true;
}

function movePanelCursorToEdge(
  view: EditorView,
  edge: "first" | "last"
): boolean {
  const cursor = cursorOf(view);
  const level = rootPanels.get(view)?.levelAt(cursor.slice(0, -1));
  if (cursor.length === 0 || !level) {
    return false;
  }
  const index = edge === "first" ? 0 : level.size - 1;
  view.dispatch({
    effects: setPanelCursor.of([...cursor.slice(0, -1), index]),
  });
  return true;
}

/** Writes the path of the row the cursor is on, as clicking it would. */
export const acceptPanelRow: Command = (view) => {
  const cursor = cursorOf(view);
  const row = rootPanels.get(view)?.rowAt(cursor);
  if (cursor.length === 0 || row === undefined) {
    return false;
  }
  pickRow({ view, row });
  return true;
};

function pickRow({
  view,
  row,
}: {
  view: EditorView;
  row: EvaluatorPathCompletion;
}) {
  writeEvaluatorPathCompletion({
    view,
    completion: row,
    to: view.state.doc.length,
  });
  if (!row.drills) {
    closeCompletion(view);
  }
}

/**
 * One level of the cascade: the rows below a path, and the level below
 * whichever of them is open. The cursor is drawn here from the editor's
 * state; the pointer resting on a row moves that state.
 */
class PanelLevel {
  readonly dom: HTMLElement;
  private readonly list: HTMLElement;
  private readonly rows: readonly {
    item: HTMLElement;
    row: EvaluatorPathCompletion;
  }[];
  private readonly id: string;
  private nested: { index: number; level: PanelLevel } | null = null;
  private hoverTimer: number | undefined;

  constructor(
    private readonly options: {
      view: EditorView;
      path: string;
      note?: string;
      getRows: EvaluatorPathSubmenuRows;
      id: string;
      prefix: EvaluatorPathPanelCursor;
    }
  ) {
    const { view, path, note, getRows, id, prefix } = options;
    this.id = id;
    this.dom = createElement("div", "evaluator-path-panel");
    if (note) {
      this.dom.append(createElement("div", "evaluator-path-panel__note", note));
    }
    this.list = createElement("ul", "evaluator-path-panel__rows");
    this.list.id = id;
    this.list.setAttribute("role", "listbox");
    this.list.setAttribute("aria-label", `Inside ${path}`);
    this.rows = getRows(path).map((row, index) => {
      const item = renderSubmenuRow({ view, row, id: toRowId(id, index) });
      item.addEventListener("mouseenter", () => {
        this.hoverTimer = window.setTimeout(() => {
          view.dispatch({ effects: setPanelCursor.of([...prefix, index]) });
        }, HOVER_SELECT_DELAY_MS);
      });
      item.addEventListener("mouseleave", () =>
        window.clearTimeout(this.hoverTimer)
      );
      this.list.append(item);
      return { item, row };
    });
    // Scrolling moves the rows out from under an open level, which follows.
    this.list.addEventListener("scroll", () => {
      if (this.nested !== null) {
        placeNestedPanel({
          panel: this.dom,
          item: this.rows[this.nested.index].item,
          nested: this.nested.level.dom,
        });
      }
    });
    this.dom.append(this.list);
  }

  get size(): number {
    return this.rows.length;
  }

  /** The level the cursor's last index is in, or `null` if it is not open. */
  levelAt(cursor: EvaluatorPathPanelCursor): PanelLevel | null {
    if (cursor.length === 0) {
      return this;
    }
    const [index, ...rest] = cursor;
    return this.nested?.index === index
      ? this.nested.level.levelAt(rest)
      : null;
  }

  rowAt(cursor: EvaluatorPathPanelCursor): EvaluatorPathCompletion | undefined {
    return this.levelAt(cursor.slice(0, -1))?.rows[cursor[cursor.length - 1]]
      ?.row;
  }

  /** Ids follow the cursor, so they are known before the level is drawn. */
  listId(prefix: EvaluatorPathPanelCursor): string {
    return prefix.reduce((id, index) => `${id}-${index}-rows`, this.id);
  }

  rowId(cursor: EvaluatorPathPanelCursor): string {
    return toRowId(this.listId(cursor.slice(0, -1)), cursor[cursor.length - 1]);
  }

  /**
   * Draws the cursor from this level down: the row it rests on, the row
   * whose level it is in, and the level below either — what a row holds
   * shows beside it while the cursor rests there, as it does on hover.
   */
  sync(cursor: EvaluatorPathPanelCursor) {
    const index = cursor[0];
    const entry = index === undefined ? undefined : this.rows[index];
    const opens = entry !== undefined && entry.row.drills === true;
    this.rows.forEach(({ item }, i) => {
      const isActive = i === index && cursor.length === 1;
      if (isActive) {
        item.setAttribute("aria-selected", "true");
      } else {
        item.removeAttribute("aria-selected");
      }
      item.toggleAttribute("data-open", opens && i === index);
    });
    if (
      entry !== undefined &&
      cursor.length === 1 &&
      typeof entry.item.scrollIntoView === "function"
    ) {
      entry.item.scrollIntoView({ block: "nearest" });
    }
    if (!opens || index === undefined) {
      this.closeNested();
      return;
    }
    if (this.nested?.index !== index) {
      this.closeNested();
      this.openNested(index);
    }
    this.nested?.level.sync(cursor.slice(1));
  }

  destroy() {
    window.clearTimeout(this.hoverTimer);
    this.closeNested();
  }

  private openNested(index: number) {
    const { view, getRows, prefix } = this.options;
    const { item, row } = this.rows[index];
    const level = new PanelLevel({
      view,
      path: row.path,
      note: row.note,
      getRows,
      id: this.listId([index]),
      prefix: [...prefix, index],
    });
    level.dom.classList.add("evaluator-path-panel--nested");
    this.dom.append(level.dom);
    placeNestedPanel({ panel: this.dom, item, nested: level.dom });
    this.nested = { index, level };
  }

  private closeNested() {
    if (this.nested === null) {
      return;
    }
    this.nested.level.destroy();
    this.nested.level.dom.remove();
    this.nested = null;
  }
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

/**
 * A row's id ends in a word rather than its index: the menu takes a press on
 * any `li` whose id ends in a number as a press on its own row of that
 * index, and these rows sit inside the menu's tooltip.
 */
function toRowId(listId: string, index: number): string {
  return `${listId}-${index}-row`;
}

function renderSubmenuRow({
  view,
  row,
  id,
}: {
  view: EditorView;
  row: EvaluatorPathCompletion;
  id: string;
}): HTMLElement {
  const item = createElement("li", toTypeaheadCompletionClass(row.type ?? ""));
  item.id = id;
  item.setAttribute("role", "option");
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
    pickRow({ view, row });
  });
  return item;
}
