import { css } from "@emotion/react";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useParams } from "react-router";
import invariant from "tiny-invariant";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import {
  Button,
  DebouncedSearch,
  Dialog,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
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
import type {
  EditableTableChangeCounts,
  EditableTableStore,
} from "@phoenix/components/table";
import {
  getEditableTableChangeCount,
  getEditableTableChangeCounts,
} from "@phoenix/components/table";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { AddDatasetExampleButton } from "@phoenix/pages/dataset/AddDatasetExampleButton";
import { useExamplesFilterContext } from "@phoenix/pages/examples/ExamplesFilterContext";
import { ExamplesSplitsMenu } from "@phoenix/pages/examples/ExamplesSplitsMenu";
import { generateUUID } from "@phoenix/utils/uuidUtils";

import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";
import { getDuplicateExternalIdRowIds } from "./duplicateExternalIds";
import { SaveDatasetExamplesDialog } from "./SaveDatasetExamplesDialog";

// A Pierre-style diffstat: a right-aligned, reserved-width slot so the summary
// renders consistently. Counts grow leftward into the reserved space instead
// of pushing the action buttons — and the search field — around as the user
// edits. Monospace + tabular figures keep the numbers from jittering.
const diffStatCSS = css`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--global-dimension-size-100);
  min-width: 110px;
  white-space: nowrap;
  font-family: var(--global-font-family-mono);
  font-size: var(--global-font-size-s);
  font-variant-numeric: tabular-nums;
  line-height: 1;
`;

const diffStatCountsCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
`;

/** Spells out the diffstat's symbols, e.g. "2 added, 1 deleted". */
const describeChangeCounts = ({
  added,
  updated,
  deleted,
}: EditableTableChangeCounts) =>
  (
    [
      [added, "added"],
      [updated, "updated"],
      [deleted, "deleted"],
    ] as const
  )
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(", ");

// Compact duplicate-ID indicator — an icon + count rather than a wide prose
// string, so an error surfacing doesn't jump the toolbar layout.
const diffStatErrorCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-25);
  color: var(--global-color-danger);
  .icon-wrap {
    flex-shrink: 0;
  }
`;

// A hairline divider separating the diffstat from the action cluster, the way
// a modern editor's status bar segments its regions.
const editActionsDividerCSS = css`
  width: 1px;
  align-self: stretch;
  margin: var(--global-dimension-size-50) 0;
  background-color: var(--global-border-color-default);
`;

export const ExamplesFilterBar = ({
  editStore,
}: {
  editStore: EditableTableStore<DatasetExampleTableRow>;
}) => {
  const {
    setFilter,
    filter,
    selectedSplitIds,
    setSelectedSplitIds,
    setSelectedExampleIds,
  } = useExamplesFilterContext();
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const mode = useStore(editStore, (state) => state.mode);
  const changeCount = useStore(editStore, getEditableTableChangeCount);
  // Two new examples sharing a custom ID is the one rejection the client can
  // pin on a specific cell, so it blocks the save here. A custom ID that
  // collides with an example already in the dataset is caught by the server —
  // the client only ever holds a page of them, so checking here would miss
  // collisions rather than prevent them. That save is rejected whole, with the
  // offending IDs named in the error.
  const duplicateRowIds = useStore(
    editStore,
    useShallow(getDuplicateExternalIdRowIds)
  );
  const duplicateIdCount = duplicateRowIds.length;
  const { added, updated, deleted } = useStore(
    editStore,
    useShallow(getEditableTableChangeCounts)
  );
  const isEditing = mode !== "read";
  const isSaving = mode === "saving";
  const canSave = changeCount > 0 && duplicateIdCount === 0 && !isSaving;
  // Cmd+S / Ctrl+S opens the save dialog while editing
  useHotkeys(
    "mod+s",
    (event) => {
      // A dialog owns its own shortcuts — a cell's JSON editor saves the cell
      // with Cmd+Enter — so don't stack the save dialog on top of one. The
      // discard confirmation is an alertdialog, so match both roles.
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[role="dialog"],[role="alertdialog"]')
      ) {
        return;
      }
      if (canSave) {
        setIsSaveDialogOpen(true);
      }
    },
    {
      enabled: isEditing,
      enableOnFormTags: true,
      preventDefault: true,
    }
  );
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");
  const datasetName = useDatasetContext((state) => state.datasetName);
  const refreshLatestVersion = useDatasetContext(
    (state) => state.refreshLatestVersion
  );
  return (
    <View
      padding="size-100"
      // prevent the example table from eating the bottom of the filter bar
      // TODO: refactor the dataset page layout css to not have to do this
      minHeight={54}
      borderBottomWidth="thin"
      borderBottomColor="default"
    >
      <Flex
        width="100%"
        justifyContent="space-between"
        gap="size-100"
        alignItems="center"
        wrap="nowrap"
      >
        <View
          flexGrow={1}
          flexShrink={1}
          minWidth={200}
          css={css`
            .search-field {
              width: 100%;
            }
          `}
        >
          <DebouncedSearch
            defaultValue={filter}
            onChange={setFilter}
            placeholder="Search examples by input, output, or metadata"
            aria-label="Search examples"
            // Filtering refetches the baseline rows. An edited or deleted row
            // that falls out of the new filter would vanish from the table while
            // still being committed on save, so searching waits until the edit
            // session ends.
            isDisabled={isEditing}
          />
        </View>
        {isEditing ? (
          <Flex
            direction="row"
            gap="size-100"
            alignItems="center"
            flexShrink={0}
          >
            <div css={diffStatCSS}>
              {changeCount === 0 ? (
                <Text color="text-500">No changes</Text>
              ) : (
                <TooltipTrigger>
                  <TriggerWrap>
                    <span css={diffStatCountsCSS}>
                      {added > 0 ? <Text color="success">+{added}</Text> : null}
                      {updated > 0 ? (
                        <Text color="warning">~{updated}</Text>
                      ) : null}
                      {deleted > 0 ? (
                        <Text color="danger">−{deleted}</Text>
                      ) : null}
                    </span>
                  </TriggerWrap>
                  <Tooltip>
                    {describeChangeCounts({ added, updated, deleted })}
                  </Tooltip>
                </TooltipTrigger>
              )}
              {duplicateIdCount > 0 ? (
                <TooltipTrigger>
                  <TriggerWrap>
                    <span
                      css={diffStatErrorCSS}
                      aria-label={`${duplicateIdCount} duplicate custom ID${
                        duplicateIdCount === 1 ? "" : "s"
                      }`}
                    >
                      <Icon svg={<Icons.AlertCircle />} color="danger" />
                      <Text color="danger">{duplicateIdCount}</Text>
                    </span>
                  </TriggerWrap>
                  <Tooltip>
                    {`${duplicateIdCount} duplicate custom ID${
                      duplicateIdCount === 1 ? "" : "s"
                    } — fix before saving`}
                  </Tooltip>
                </TooltipTrigger>
              ) : null}
            </div>
            <div css={editActionsDividerCSS} aria-hidden />
            <Button
              size="M"
              isDisabled={isSaving}
              leadingVisual={<Icon svg={<Icons.Plus />} />}
              onPress={() => {
                editStore.getState().addRow({
                  id: `new-${generateUUID()}`,
                  externalId: null,
                  splits: [],
                  input: {},
                  output: {},
                  metadata: {},
                  isNew: true,
                });
              }}
            >
              Add example
            </Button>
            <Button
              size="M"
              isDisabled={isSaving}
              onPress={() => {
                if (changeCount > 0) {
                  setIsDiscardDialogOpen(true);
                } else {
                  editStore.getState().cancelEditing();
                }
              }}
            >
              Cancel
            </Button>
            <Button
              variant={changeCount > 0 ? "primary" : "default"}
              size="M"
              isDisabled={!canSave}
              leadingVisual={<Icon svg={<Icons.Save />} />}
              onPress={() => setIsSaveDialogOpen(true)}
            >
              Save changes
            </Button>
          </Flex>
        ) : (
          <Flex
            direction="row"
            gap="size-100"
            alignItems="center"
            flexShrink={0}
          >
            <ExamplesSplitsMenu
              onSelectionChange={setSelectedSplitIds}
              selectedSplitIds={selectedSplitIds}
            />
            <AddDatasetExampleButton
              datasetId={datasetId}
              datasetName={datasetName}
              onAddExampleCompleted={refreshLatestVersion}
            />
            <Button
              variant="primary"
              size="M"
              leadingVisual={<Icon svg={<Icons.Edit />} />}
              onPress={() => {
                setSelectedExampleIds([]);
                editStore.getState().beginEditing();
              }}
            >
              Edit
            </Button>
          </Flex>
        )}
      </Flex>
      <ModalOverlay
        isOpen={isDiscardDialogOpen}
        onOpenChange={setIsDiscardDialogOpen}
        isDismissable
      >
        <Modal size="S">
          {/* A destructive confirmation, not a plain dialog. */}
          <Dialog role="alertdialog">
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Discard example changes</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text>
                  {`This will discard ${changeCount} unsaved change${
                    changeCount === 1 ? "" : "s"
                  } to the dataset examples.`}
                </Text>
              </View>
              <DialogFooter>
                <Button variant="default" slot="close">
                  Keep editing
                </Button>
                <Button
                  variant="danger"
                  onPress={() => {
                    setIsDiscardDialogOpen(false);
                    editStore.getState().cancelEditing();
                  }}
                >
                  Discard changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
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
    </View>
  );
};
