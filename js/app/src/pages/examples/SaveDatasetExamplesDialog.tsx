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
import type { EditableTableStore } from "@phoenix/components/table";
import {
  getEditableTableChangeCount,
  getEditableTableChangeCounts,
} from "@phoenix/components/table";
import { useNotifySuccess } from "@phoenix/contexts";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { SaveDatasetExamplesDialogMutation } from "./__generated__/SaveDatasetExamplesDialogMutation.graphql";
import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";

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
  const {
    added: additionCount,
    updated: updateCount,
    deleted: deletionCount,
  } = useStore(editStore, useShallow(getEditableTableChangeCounts));
  const refreshLatestVersion = useDatasetContext(
    (state) => state.refreshLatestVersion
  );
  const notifySuccess = useNotifySuccess();
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
  const changeCount = useStore(editStore, getEditableTableChangeCount);
  const canSave = changeCount > 0 && !isCommitting;

  const saveChanges = () => {
    setSaveError(null);
    const diff = editStore.getState().getDiff();
    editStore.getState().startSaving();
    commitChanges({
      variables: {
        input: {
          datasetId,
          additions: diff.addedRows.map((row) => {
            const externalId = row.externalId?.trim();
            return {
              input: row.input,
              output: row.output,
              metadata: row.metadata,
              // Omit when blank so the server generates the ID.
              ...(externalId ? { externalId } : {}),
            };
          }),
          patches: diff.updatedRows.map(({ rowId, changes }) => ({
            exampleId: rowId,
            ...(changes.input !== undefined ? { input: changes.input } : {}),
            ...(changes.output !== undefined ? { output: changes.output } : {}),
            ...(changes.metadata !== undefined
              ? { metadata: changes.metadata }
              : {}),
          })),
          exampleIdsToDelete: diff.deletedRowIds,
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
        // The table stays in "saving" until the new version's rows arrive, so the
        // pending edits never flicker away before their saved counterparts. If we
        // cannot even fetch the new version, hand editing back rather than
        // stranding the table with every control disabled.
        refreshLatestVersion().catch(() => {
          editStore.getState().stopSaving();
        });
      },
      onError: (error) => {
        editStore.getState().stopSaving();
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
      isDismissable={!isCommitting}
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
                {(
                  [
                    ["Added", additionCount, "success"],
                    ["Updated", updateCount, "warning"],
                    ["Deleted", deletionCount, "danger"],
                  ] as const
                ).map(([label, count, color]) => (
                  <li key={label} data-empty={count === 0}>
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
                ))}
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
                isDisabled={changeCount === 0 || isCommitting}
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
