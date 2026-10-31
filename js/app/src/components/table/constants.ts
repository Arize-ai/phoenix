import type { ColumnPinningState } from "@tanstack/react-table";

/**
 * Column id shared by every table's row-selection checkbox column.
 */
export const CHECKBOX_COLUMN_ID = "select";

/**
 * Column id shared by every table's pinned row-actions column.
 */
export const ACTIONS_COLUMN_ID = "actions";

/**
 * Pins the checkbox column to the start (left) so it stays visible while a
 * table's other columns scroll horizontally.
 */
export const CHECKBOX_COLUMN_PINNING = {
  start: [CHECKBOX_COLUMN_ID],
  end: [],
} satisfies ColumnPinningState;

/**
 * Pins the row-actions column to the end (right) so it stays visible while a
 * table's other columns scroll horizontally.
 */
export const ACTIONS_COLUMN_PINNING = {
  start: [],
  end: [ACTIONS_COLUMN_ID],
} satisfies ColumnPinningState;
