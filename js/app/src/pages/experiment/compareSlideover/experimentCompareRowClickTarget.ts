import type { MouseEvent } from "react";

const INTERACTIVE_ELEMENT_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
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
 * highlight, and a click handler that leaves clicks on controls inside the
 * row to those controls. Without `onRowClick` the row is not clickable.
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
            if (!isInteractiveClickTarget(event.target)) {
              onRowClick(rowId);
            }
          }
        : undefined,
    style: { cursor: onRowClick != null ? "pointer" : undefined },
  };
}
