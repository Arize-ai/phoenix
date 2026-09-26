import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { tooltips } from "@codemirror/view";

import { APP_PORTALED_OVERLAY_Z_INDEX } from "@phoenix/components/core/zIndex";

const TYPEAHEAD_TOOLTIP_LAYER_ID = "cm-typeahead-tooltip-layer";

/**
 * The gap `typeaheadMenuCSS` translates the menu down by to clear the field's
 * inner padding — `--global-dimension-size-200`, published to the menu as
 * `--typeahead-menu-gap` so the two can never drift.
 */
const TYPEAHEAD_MENU_GAP_PX = 16;

/**
 * A zero-sized, viewport-fixed element at the end of `document.body` that
 * every completion menu is rendered into. Zero-sized so it never intercepts a
 * pointer; its menus paint and are clickable regardless.
 */
function typeaheadTooltipLayer(): HTMLElement {
  const existing = document.getElementById(TYPEAHEAD_TOOLTIP_LAYER_ID);
  if (existing) {
    return existing;
  }
  const layer = document.createElement("div");
  layer.id = TYPEAHEAD_TOOLTIP_LAYER_ID;
  layer.style.position = "fixed";
  layer.style.top = "0";
  layer.style.left = "0";
  layer.style.width = "0";
  layer.style.height = "0";
  // A completion menu is a transient surface that has to win against whatever
  // opened it — a dialog, a drawer, a popover
  layer.style.zIndex = APP_PORTALED_OVERLAY_Z_INDEX;
  layer.style.setProperty("--typeahead-menu-gap", `${TYPEAHEAD_MENU_GAP_PX}px`);
  document.body.appendChild(layer);
  return layer;
}

/**
 * The viewport, inset by the gap the menu is translated down by. CodeMirror
 * sizes and sides the menu against this before the translation is applied, so
 * without the inset a menu that exactly fills the space below the cursor ends
 * up hanging that far past the bottom of the screen.
 *
 * @internal Exported for testing
 */
export function typeaheadTooltipSpace(view: EditorView) {
  const { clientHeight, clientWidth } = view.dom.ownerDocument.documentElement;
  return {
    top: TYPEAHEAD_MENU_GAP_PX,
    left: 0,
    bottom: clientHeight - TYPEAHEAD_MENU_GAP_PX,
    right: clientWidth,
  };
}

/**
 * Renders an editor's completion menu in the body layer instead of inside the
 * editor.
 *
 * Every form hosting one of these editors puts it behind an `overflow`
 * ancestor (the field's own chrome, a scrolling dialog body, a message card),
 * and a centered dialog is permanently `transform`ed, which drops CodeMirror
 * from viewport-fixed to absolute positioning inside the editor. Either way
 * the menu is cut off at the first clipping ancestor while CodeMirror keeps
 * measuring its room against the whole viewport, so it also flips above the
 * cursor with space to spare below. In the layer both are true again.
 *
 * `typeaheadMenuCSS` is global for the same reason — the menu no longer lands
 * under the wrapper that would otherwise scope it.
 */
export function typeaheadTooltips(): Extension {
  return tooltips({
    parent: typeaheadTooltipLayer(),
    tooltipSpace: typeaheadTooltipSpace,
  });
}
