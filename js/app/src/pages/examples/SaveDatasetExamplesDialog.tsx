import { css } from "@emotion/react";
import { useState } from "react";
import { TextArea } from "react-aria-components";
import { graphql, useMutation } from "react-relay";
import { useStore } from "zustand";

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
  const additionCount = useStore(editStore, (state) => state.addedRows.length);
  const updateCount = useStore(
    editStore,
    (state) =>
      Object.keys(state.updatedRows).filter(
        (rowId) => !state.deletedRowIds.has(rowId)
      ).length
  );
  const deletionCount = useStore(
    editStore,
    (state) => state.deletedRowIds.size
  );
  const refreshLatestVersion = useDatasetContext(
    (state) => state.refreshLatestVersion
  );
  const notifySuccess = useNotifySuccess();
  const [commitChanges, isCommitting] =
    useMutation<SaveDatasetExamplesDialogMutation>(graphql`
      mutation SaveDatasetExamplesDialogMutation(
        $input: ApplyDatasetExampleChangesInput!
      ) {
        applyDatasetExampleChanges(input: $input) {
          dataset {
            id
            exampleCount
          }
        }
      }
    `);
  const changeCount = additionCount + updateCount + deletionCount;

  const saveChanges = () => {
    setSaveError(null);
    const diff = editStore.getState().getDiff();
    editStore.getState().startSaving();
    commitChanges({
      variables: {
        input: {
          datasetId,
          additions: diff.addedRows.map((row) => ({
            input: row.input,
            output: row.output,
            metadata: row.metadata,
          })),
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
          message: `${changeCount} example change${changeCount === 1 ? "" : "s"} committed.`,
        });
        refreshLatestVersion();
      },
      onError: (error) => {
        editStore.getState().stopSaving();
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        setSaveError(formattedError?.[0] ?? error.message);
      },
    });
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        if (nextIsOpen) {
          setSaveError(null);
        }
        onOpenChange(nextIsOpen);
      }}
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
                <li>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Text size="S" color="text-700">
                      Added
                    </Text>
                    <Text>{additionCount}</Text>
                  </Flex>
                </li>
                <li>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Text size="S" color="text-700">
                      Updated
                    </Text>
                    <Text>{updateCount}</Text>
                  </Flex>
                </li>
                <li>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Text size="S" color="text-700">
                      Deleted
                    </Text>
                    <Text>{deletionCount}</Text>
                  </Flex>
                </li>
              </ul>
              <View paddingTop="size-200">
                <TextField
                  value={versionDescription}
                  onChange={setVersionDescription}
                >
                  <Label>Version description</Label>
                  <TextArea
                    rows={3}
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
