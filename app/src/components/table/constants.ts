import type { ColumnPinningState } from "@tanstack/react-table";

/**
 * Column id shared by every table's row-selection checkbox column.
 */
export const CHECKBOX_COLUMN_ID = "select";

/**
 * Pins the checkbox column to the left so it stays visible while a table's
 * other columns scroll horizontally.
 */
export const CHECKBOX_COLUMN_PINNING = {
  left: [CHECKBOX_COLUMN_ID],
} satisfies ColumnPinningState;
