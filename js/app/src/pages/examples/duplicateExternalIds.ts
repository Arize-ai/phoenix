import { getEditableTableCellValue } from "@phoenix/store/editableTableStore";
import type { EditableTableState } from "@phoenix/types/editableTable";

import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";

export const DUPLICATE_ID_ERROR =
  "Custom IDs must be unique among new examples.";

/**
 * The new examples whose custom ID collides with another new example's.
 *
 * The server rejects the whole change set when two added examples share a custom
 * ID, so the collision is caught here — where the offending cells can be pointed
 * at — rather than at the end of the save dialog. This is derived from the store
 * on every read instead of being mirrored into it, so it cannot fall out of step
 * with what the user has typed.
 */
export function getDuplicateExternalIdRowIds(
  state: EditableTableState<DatasetExampleTableRow>
): string[] {
  const rowIdsByCustomId = new Map<string, string[]>();
  for (const row of state.addedRows) {
    const customId = getEditableTableCellValue({
      state,
      rowId: row.id,
      columnId: "externalId",
      originalValue: row.externalId,
    })?.trim();
    if (!customId) {
      continue;
    }
    const rowIds = rowIdsByCustomId.get(customId);
    if (rowIds) {
      rowIds.push(row.id);
    } else {
      rowIdsByCustomId.set(customId, [row.id]);
    }
  }
  return [...rowIdsByCustomId.values()]
    .filter((rowIds) => rowIds.length > 1)
    .flat();
}
