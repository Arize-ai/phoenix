import type { EditableTableStoreState } from "@phoenix/components/table";

import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";

export const DUPLICATE_ID_ERROR =
  "Custom IDs must be unique among new examples.";

/**
 * The new examples whose custom ID collides with another new example's.
 *
 * The server rejects the whole change set when two added examples share a custom
 * ID, so the collision is caught here — where the offending cells can be pointed
 * at — rather than at the end of the save dialog. This is derived from the added
 * rows on every read instead of being mirrored into the store, so it cannot fall
 * out of step with what the user has typed.
 */
export function getDuplicateExternalIdRowIds(
  state: EditableTableStoreState<DatasetExampleTableRow>
): string[] {
  const rowIdsByCustomId = new Map<string, string[]>();
  for (const row of state.addedRows) {
    const customId = row.externalId?.trim();
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
