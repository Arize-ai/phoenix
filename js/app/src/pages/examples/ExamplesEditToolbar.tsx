import { css } from "@emotion/react";
import { useState } from "react";
import { useParams } from "react-router";
import invariant from "tiny-invariant";
import { useStore } from "zustand";

import {
  Button,
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { EditableTableToolbar } from "@phoenix/components/table";
import type { EditableTableStore } from "@phoenix/types/editableTable";
import { generateUUID } from "@phoenix/utils/uuidUtils";

import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";
import { getDuplicateExternalIdRowIds } from "./duplicateExternalIds";
import type { NewExampleTemplate } from "./newExampleTemplate";
import { SaveDatasetExamplesDialog } from "./SaveDatasetExamplesDialog";
import { describeUnsavedExampleChanges } from "./unsavedExampleChanges";

const summaryNoteCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-25);
  .icon-wrap {
    flex-shrink: 0;
  }
`;

// The hidden-change note is informational, so it reads in muted text.
const hiddenNoteCSS = css`
  ${summaryNoteCSS};
  color: var(--global-text-color-500);
`;

/**
 * The edit toolbar for the examples table: the shared editable-table toolbar
 * plus the example-specific parts — adding an example, the duplicate custom ID
 * warning, the count of changes the current search hides, and the dialog that
 * commits the session as a dataset version.
 */
export function ExamplesEditToolbar({
  editStore,
  newExampleTemplate,
  hiddenChangeCount,
}: {
  editStore: EditableTableStore<DatasetExampleTableRow>;
  /** The input, output, and metadata a newly added example starts with. */
  newExampleTemplate: NewExampleTemplate;
  /** Changed examples the table is not showing because of the search. */
  hiddenChangeCount: number;
}) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const isSaving = useStore(editStore, (state) => state.mode === "saving");
  // Duplicate custom IDs among new examples are caught here, where the
  // offending cells can be pointed at. Collisions with examples already in the
  // dataset are validated by the server, which rejects the whole save and
  // names the offending IDs; the client only holds a page of examples.
  const duplicateIdCount = useStore(
    editStore,
    (state) => getDuplicateExternalIdRowIds(state).length
  );
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");
  return (
    <>
      <EditableTableToolbar
        store={editStore}
        label="Edit examples"
        canSave={duplicateIdCount === 0}
        onSave={() => setIsSaveDialogOpen(true)}
        discardTitle="Discard example changes"
        describeUnsavedChanges={describeUnsavedExampleChanges}
        summaryExtra={
          <>
            {duplicateIdCount > 0 ? (
              <TooltipTrigger>
                <TriggerWrap>
                  <span css={summaryNoteCSS}>
                    <Icon svg={<Icons.AlertCircle />} color="danger" />
                    <Text color="danger">
                      {`${duplicateIdCount} duplicate ID${
                        duplicateIdCount === 1 ? "" : "s"
                      }`}
                    </Text>
                  </span>
                </TriggerWrap>
                <Tooltip>
                  Two new examples share a custom ID. Fix before saving.
                </Tooltip>
              </TooltipTrigger>
            ) : null}
            {hiddenChangeCount > 0 ? (
              <TooltipTrigger>
                <TriggerWrap>
                  <span css={hiddenNoteCSS}>
                    <Icon svg={<Icons.EyeOff />} color="inherit" />
                    <Text color="text-500">
                      {`${hiddenChangeCount} hidden by search`}
                    </Text>
                  </span>
                </TriggerWrap>
                <Tooltip>
                  {hiddenChangeCount === 1
                    ? "One changed example does not match the current search or splits. It is still saved with the rest."
                    : `${hiddenChangeCount} changed examples do not match the current search or splits. They are still saved with the rest.`}
                </Tooltip>
              </TooltipTrigger>
            ) : null}
          </>
        }
      >
        <Button
          size="M"
          isDisabled={isSaving}
          leadingVisual={<Icon svg={<Icons.Plus />} />}
          onPress={() => {
            editStore.getState().addRow({
              id: `new-${generateUUID()}`,
              externalId: null,
              splits: [],
              ...newExampleTemplate,
              isNew: true,
            });
          }}
        >
          Add example
        </Button>
      </EditableTableToolbar>
      {/* Mounted only while open, so a failed save's error banner and the version
          description it was typed with cannot survive into the next save. */}
      {isSaveDialogOpen ? (
        <SaveDatasetExamplesDialog
          datasetId={datasetId}
          editStore={editStore}
          isOpen
          onOpenChange={setIsSaveDialogOpen}
        />
      ) : null}
    </>
  );
}
