import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  Popover,
} from "@phoenix/components";
import { ColumnSelectorMenu } from "@phoenix/components/table/columnSelector";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { getPlaygroundTaskKind } from "@phoenix/store/playground";

import {
  EXAMPLE_COLUMNS,
  getExampleColumnLabels,
  getExampleColumnVisibility,
} from "./exampleColumns";
import { usePlaygroundDatasetExamplesTablePreferences } from "./PlaygroundDatasetExamplesTablePreferences";

/**
 * Shows or hides the example's own columns of the dataset table. Only those
 * are optional; the task columns are what the table is for.
 */
export function PlaygroundExampleColumnSelector({
  hasMetadata,
}: {
  /**
   * Whether a loaded example has metadata to show. Until a choice is stored,
   * this is what shows the metadata column, so the checkbox follows it.
   */
  hasMetadata: boolean;
}) {
  const storedVisibility = usePlaygroundDatasetExamplesTablePreferences(
    (state) => state.columnVisibility
  );

  const setColumnVisibility = usePlaygroundDatasetExamplesTablePreferences(
    (state) => state.setColumnVisibility
  );

  const columnVisibility = getExampleColumnVisibility({
    hasMetadata,
    storedVisibility,
  });

  const columnLabels = usePlaygroundContext((state) =>
    getExampleColumnLabels(getPlaygroundTaskKind(state.instances))
  );

  return (
    <DialogTrigger>
      <Button size="S" leadingVisual={<Icon svg={<Icons.Column />} />}>
        Columns
      </Button>
      <Popover placement="bottom end">
        <ColumnSelectorMenu
          columns={EXAMPLE_COLUMNS.map((column) => ({
            id: column,
            label: columnLabels[column],
          }))}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
        />
      </Popover>
    </DialogTrigger>
  );
}
