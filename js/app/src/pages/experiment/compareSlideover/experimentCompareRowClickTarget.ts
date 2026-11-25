import type { MouseEvent } from "react";

const INTERACTIVE_ELEMENT_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "summary",
  "label",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[contenteditable]:not([contenteditable="false"])',
].join(", ");

/**
 * Whether a click landed on a control inside a table row, which then owns
 * the click instead of the row.
 */
export function isInteractiveClickTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(INTERACTIVE_ELEMENT_SELECTOR) != null
  );
}

/**
 * The props that tie a compare table row to the slideover: the selected
 * highlight, and a click handler that opens the row's example. Clicks on
 * controls inside the row stay with those controls, and a click that ends a
 * text selection is not a row click. Without `onRowClick` the row is not
 * clickable.
 */
export function getCompareRowProps({
  rowId,
  selectedRowId,
  onRowClick,
}: {
  rowId: string;
  /** The row whose example is open in the slideover */
  selectedRowId: string | null | undefined;
  onRowClick: ((rowId: string) => void) | undefined;
}) {
  return {
    "data-selected": rowId === selectedRowId,
    onClick:
      onRowClick != null
        ? (event: MouseEvent<HTMLTableRowElement>) => {
            // React delivers clicks from portaled overlays, such as a popover
            // opened from the row, to the row as well
            const isInsideRow =
              event.target instanceof Node &&
              event.currentTarget.contains(event.target);
            const isSelectingText =
              window.getSelection()?.isCollapsed === false;
            if (
              isInsideRow &&
              !isSelectingText &&
              !isInteractiveClickTarget(event.target)
            ) {
              onRowClick(rowId);
            }
          }
        : undefined,
    style: { cursor: onRowClick != null ? "pointer" : undefined },
  };
}
