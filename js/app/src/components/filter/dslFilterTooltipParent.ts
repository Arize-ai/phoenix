const DSL_FILTER_TOOLTIP_PARENT_SELECTOR =
  '[data-overlay-container="modal"], [data-overlay-container="application"]';

/**
 * Finds the overlay container CodeMirror tooltips should portal into.
 *
 * The nearest matching container wins, so a filter inside a modal stays in
 * the modal subtree while a filter on a normal page uses the application
 * viewport.
 */
export function findDSLFilterTooltipParent(
  editorElement: HTMLElement
): HTMLElement | null {
  const parent = editorElement.closest<HTMLElement>(
    DSL_FILTER_TOOLTIP_PARENT_SELECTOR
  );
  parent?.classList.add("dsl-filter-tooltip-root");
  return parent;
}
