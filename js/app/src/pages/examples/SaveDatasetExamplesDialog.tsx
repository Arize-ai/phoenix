import { css } from "@emotion/react";
import { useState } from "react";
import { TextArea } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";
import { graphql, useMutation } from "react-relay";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import {
  Alert,
  Button,
  Dialog,
  Flex,
  Icon,
  Icons,
  Label,
  Modal,
  ModalOverlay,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { EDITABLE_TABLE_CHANGE_KINDS } from "@phoenix/components/table";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { getEditableTableChangeCounts } from "@phoenix/store/editableTableStore";
import type {
  EditableTableDiff,
  EditableTableStore,
} from "@phoenix/types/table";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type {
  DatasetExampleField,
  DatasetExampleOperation,
  SaveDatasetExamplesDialogMutation,
} from "./__generated__/SaveDatasetExamplesDialogMutation.graphql";
import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";

/** The editable columns and the GraphQL field each one replaces. */
const REPLACEABLE_FIELDS = [
  ["input", "INPUT"],
  ["output", "OUTPUT"],
  ["metadata", "METADATA"],
] as const satisfies ReadonlyArray<
  readonly [keyof DatasetExampleTableRow, DatasetExampleField]
>;

/**
 * Turns the edit session's diff into the mutation's operation list: one
 * `replace` per changed cell, one `remove` per deleted row, and one `add` per
 * new row. The store never holds a change to a deleted row, so the order
 * carries no conflicts for the server to resolve.
 */
function toDatasetExampleOperations(
  diff: EditableTableDiff<DatasetExampleTableRow>
): DatasetExampleOperation[] {
  return [
    ...diff.updatedRows.flatMap(({ rowId, changes }) =>
      REPLACEABLE_FIELDS.flatMap(([columnId, field]) =>
        changes[columnId] === undefined
          ? []
          : [{ replace: { exampleId: rowId, field, value: changes[columnId] } }]
      )
    ),
    ...diff.deletedRowIds.map((exampleId) => ({ remove: { exampleId } })),
    ...diff.addedRows.map((row) => {
      const externalId = row.externalId?.trim();
      return {
        add: {
          value: {
            input: row.input,
            output: row.output,
            metadata: row.metadata,
            // Omit when blank so the server generates the ID.
            ...(externalId ? { externalId } : {}),
          },
        },
      };
    }),
  ];
}

const changeSummaryCSS = css`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--global-dimension-size-100);
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    padding: var(--global-dimension-size-100);
    border: var(--global-border-size-thin) solid
      var(--global-border-color-default);
    border-radius: var(--global-rounding-small);
    background: var(--global-table-header-background-color);
  }

  li[data-empty="true"] {
    opacity: 0.5;
  }
`;

type SaveDatasetExamplesDialogProps = {
  datasetId: string;
  editStore: EditableTableStore<DatasetExampleTableRow>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function SaveDatasetExamplesDialog({
  datasetId,
  editStore,
  isOpen,
  onOpenChange,
}: SaveDatasetExamplesDialogProps) {
  const [versionDescription, setVersionDescription] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const counts = useStore(editStore, useShallow(getEditableTableChangeCounts));
  const changeCount = counts.added + counts.updated + counts.deleted;
  const refreshLatestVersion = useDatasetContext(
    (state) => state.refreshLatestVersion
  );
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [commitChanges, isCommitting] =
    useMutation<SaveDatasetExamplesDialogMutation>(graphql`
      mutation SaveDatasetExamplesDialogMutation(
        $input: PatchDatasetExamplesInput!
      ) {
        patchDatasetExamples(input: $input) {
          dataset {
            id
            exampleCount
          }
        }
      }
    `);
  const canSave = changeCount > 0 && !isCommitting;

  const saveChanges = () => {
    setSaveError(null);
    const diff = editStore.getState().getDiff();
    editStore.getState().startSaving();
    commitChanges({
      variables: {
        input: {
          datasetId,
          operations: toDatasetExampleOperations(diff),
          ...(versionDescription.trim()
            ? { versionDescription: versionDescription.trim() }
            : {}),
        },
      },
      onCompleted: () => {
        onOpenChange(false);
        notifySuccess({
          title: "Dataset version saved",
          message: `${changeCount} example change${
            changeCount === 1 ? "" : "s"
          } committed.`,
        });
        // The table stays in "saving" until the new version's rows have
        // rendered, so the pending edits never flicker away before their saved
        // counterparts. The changes are committed either way: if the new
        // version cannot be fetched, the session ends on the rows already
        // shown.
        refreshLatestVersion().catch(() => {
          editStore.getState().finishSaving();
          notifyError({
            title: "Saved, but the table could not refresh",
            message: "Reload the page to see the new dataset version.",
          });
        });
      },
      onError: (error) => {
        editStore.getState().resumeEditing();
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        setSaveError(formattedError?.[0] ?? error.message);
      },
    });
  };

  // Cmd+Enter commits from anywhere in the dialog, including the description
  // field.
  useHotkeys("mod+enter", () => saveChanges(), {
    enabled: isOpen && canSave,
    enableOnFormTags: true,
    preventDefault: true,
  });

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      // Neither the backdrop nor Escape closes the dialog while the save is in
      // flight, so its result always has somewhere to land.
      isDismissable={!isCommitting}
      isKeyboardDismissDisabled={isCommitting}
    >
      <Modal size="M">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save dataset version</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton isDisabled={isCommitting} />
              </DialogTitleExtra>
            </DialogHeader>
            {saveError ? (
              <View paddingX="size-200" paddingTop="size-100">
                <Alert variant="danger" banner>
                  {saveError}
                </Alert>
              </View>
            ) : null}
            <View padding="size-200">
              <ul css={changeSummaryCSS}>
                {EDITABLE_TABLE_CHANGE_KINDS.map(({ key, label, color }) => {
                  const count = counts[key];
                  return (
                    <li key={key} data-empty={count === 0}>
                      <Flex justifyContent="space-between" alignItems="center">
                        <Text
                          size="S"
                          color={count > 0 ? "text-700" : "text-300"}
                        >
                          {label}
                        </Text>
                        <Text color={count > 0 ? color : "text-300"}>
                          {count}
                        </Text>
                      </Flex>
                    </li>
                  );
                })}
              </ul>
              <View paddingTop="size-200">
                <TextField
                  value={versionDescription}
                  onChange={setVersionDescription}
                >
                  <Label>Version description</Label>
                  <TextArea
                    rows={3}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    placeholder="Describe the changes in this version"
                  />
                  <Text slot="description">Optional</Text>
                </TextField>
              </View>
            </View>
            <DialogFooter>
              <Button variant="default" slot="close" isDisabled={isCommitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isDisabled={!canSave}
                leadingVisual={
                  <Icon
                    svg={isCommitting ? <Icons.Loading /> : <Icons.Save />}
                  />
                }
                onPress={saveChanges}
              >
                {isCommitting ? "Saving…" : "Save version"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
