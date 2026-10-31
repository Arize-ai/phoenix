import { CHEVRON_RIGHT_SMALL_PATH } from "@phoenix/components/core/icon/chevronRightSmallPath";

import type { EvaluatorPathCount } from "./evaluatorPathCompletions";

/**
 * How long the pointer rests on a row before it is taken as the row the user
 * means. Long enough that crossing rows on the way to an open panel leaves
 * it open.
 */
export const HOVER_SELECT_DELAY_MS = 120;

/** The gap between the menu and its side panel. */
export const PANEL_GAP_PX = 4;

/**
 * How far a panel sits above its row: its border plus its padding, so its
 * first row lines up with the row that opened it.
 */
export const PANEL_INSET_PX = 5;

export const PANEL_MAX_WIDTH_PX = 400;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * The chevron a row with more inside it ends in — the glyph and size the app's
 * own menus give an item with a submenu. The glyph is decoration; what it
 * means is spelled out for a screen reader, as the app's menus do.
 */
export function createSubmenuChevron(): HTMLElement {
  const wrap = createElement("i", "icon-wrap typeahead-completion-chevron");
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const outline = document.createElementNS(SVG_NAMESPACE, "path");
  outline.setAttribute("d", CHEVRON_RIGHT_SMALL_PATH);
  svg.append(outline);
  wrap.append(svg, createElement("span", "evaluator-path-sr-only", "submenu"));
  return wrap;
}

export function createCountBadge(count: EvaluatorPathCount): HTMLElement {
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

export function createElement<K extends keyof HTMLElementTagNameMap>(
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
