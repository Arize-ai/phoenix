import type {
  Completion,
  CompletionInfo,
  CompletionResult,
} from "@codemirror/autocomplete";
import {
  autocompletion,
  currentCompletions,
  selectedCompletionIndex,
  setSelectedCompletion,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import type { EditorView, Rect } from "@codemirror/view";

import type { EvaluatorPathCount } from "./evaluatorPathCompletions";
import {
  createCountBadge,
  createElement,
  createSubmenuChevron,
  HOVER_SELECT_DELAY_MS,
  PANEL_GAP_PX,
  PANEL_INSET_PX,
  PANEL_MAX_WIDTH_PX,
} from "./evaluatorPathMenuChrome";
import { evaluatorPathPanelNavigation } from "./evaluatorPathPanel";

/** A path-field menu row, carrying what its badge and side panel show. */
export type EvaluatorPathMenuCompletion = Completion & {
  count?: EvaluatorPathCount;
  drills?: boolean;
};

/**
 * The menu chrome only the path field has: a count badge and a submenu
 * chevron on a container row, a side panel that opens on the row the pointer
 * or the keys rest on and that the arrow keys walk into, and a menu that
 * opens above the field.
 */
export function evaluatorPathMenu(): Extension {
  return [
    evaluatorPathPanelNavigation(),
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

function renderSubmenuChevron(completion: Completion): Node | null {
  return (completion as EvaluatorPathMenuCompletion).drills
    ? createSubmenuChevron()
    : null;
}

function renderCountBadge(completion: Completion): Node | null {
  const { count } = completion as EvaluatorPathMenuCompletion;
  return count ? createCountBadge(count) : null;
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
