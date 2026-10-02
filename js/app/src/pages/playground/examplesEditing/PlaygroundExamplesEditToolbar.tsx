import { useState } from "react";
import { useStore } from "zustand";

import { Button, Icon, Icons } from "@phoenix/components";
import { EditableTableToolbar } from "@phoenix/components/table";
import type { NewExampleTemplate } from "@phoenix/pages/examples/newExampleTemplate";
import { SaveDatasetExamplesDialog } from "@phoenix/pages/examples/SaveDatasetExamplesDialog";
import { describeUnsavedExampleChanges } from "@phoenix/pages/examples/unsavedExampleChanges";
import type {
  EditableTableDiff,
  EditableTableStore,
} from "@phoenix/types/table";

import {
  createNewPlaygroundExampleRow,
  type PlaygroundExampleTableRow,
} from "./playgroundExampleEditing";

/**
 * The edit toolbar for the playground's dataset table: the shared
 * editable-table toolbar with an Add example button, and the dialog that
 * commits the session as a dataset version. The same session the examples
 * page runs, in the place the examples are being judged.
 */
export function PlaygroundExamplesEditToolbar({
  datasetId,
  editStore,
  newExampleTemplate,
  onSaved,
  transformDiff,
}: {
  datasetId: string;
  editStore: EditableTableStore<PlaygroundExampleTableRow>;
  /** The input, output, and metadata a newly added example starts with. */
  newExampleTemplate: NewExampleTemplate;
  /** Reloads the examples after a save; see SaveDatasetExamplesDialog. */
  onSaved: () => Promise<unknown>;
  transformDiff: (
    diff: EditableTableDiff<PlaygroundExampleTableRow>
  ) => EditableTableDiff<PlaygroundExampleTableRow>;
}) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const isSaving = useStore(editStore, (state) => state.mode === "saving");

  return (
    <>
      <EditableTableToolbar
        store={editStore}
        label="Edit examples"
        onSave={() => setIsSaveDialogOpen(true)}
        discardTitle="Discard example changes"
        describeUnsavedChanges={describeUnsavedExampleChanges}
      >
        <Button
          size="M"
          isDisabled={isSaving}
          leadingVisual={<Icon svg={<Icons.Plus />} />}
          onPress={() =>
            editStore
              .getState()
              .addRow(createNewPlaygroundExampleRow(newExampleTemplate))
          }
        >
          Add example
        </Button>
      </EditableTableToolbar>
      {/* Mounted only while open, so a failed save's error banner and the
          version description it was typed with cannot survive into the next
          save. */}
      {isSaveDialogOpen ? (
        <SaveDatasetExamplesDialog
          datasetId={datasetId}
          editStore={editStore}
          isOpen
          onOpenChange={setIsSaveDialogOpen}
          onSaved={onSaved}
          transformDiff={transformDiff}
        />
      ) : null}
    </>
  );
}
