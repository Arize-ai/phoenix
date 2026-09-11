import { Text } from "@phoenix/components";
import type { ColorValue } from "@phoenix/components/core/types";
import type { EditableTableChangeCounts } from "@phoenix/types/editableTable";

/**
 * Each kind of pending change, with the label and color used wherever the
 * changes of an edit session are summarized.
 */
export const EDITABLE_TABLE_CHANGE_KINDS = [
  { key: "added", label: "Added", color: "success" },
  { key: "updated", label: "Updated", color: "warning" },
  { key: "deleted", label: "Deleted", color: "danger" },
] as const satisfies readonly {
  key: keyof EditableTableChangeCounts;
  label: string;
  color: ColorValue;
}[];

/**
 * The non-zero change counts as colored segments joined by commas, e.g.
 * "1 added, 2 deleted".
 */
export function EditableTableChangeSummary({
  counts,
}: {
  counts: EditableTableChangeCounts;
}) {
  const segments = EDITABLE_TABLE_CHANGE_KINDS.filter(
    ({ key }) => counts[key] > 0
  );
  if (segments.length === 0) {
    return <Text color="text-500">No changes</Text>;
  }
  return (
    <span>
      {segments.map(({ key, color }, index) => (
        <span key={key}>
          {index > 0 ? <Text color="text-500">, </Text> : null}
          <Text color={color}>{`${counts[key]} ${key}`}</Text>
        </span>
      ))}
    </span>
  );
}
