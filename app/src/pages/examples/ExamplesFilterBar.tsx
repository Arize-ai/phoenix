import { css } from "@emotion/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import invariant from "tiny-invariant";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import {
  Button,
  DebouncedSearch,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
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
import type {
  EditableTableChangeCounts,
  EditableTableStore,
} from "@phoenix/components/table";
import {
  getEditableTableChangeCount,
  getEditableTableChangeCounts,
  getEditableTableErrorCount,
} from "@phoenix/components/table";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { AddDatasetExampleButton } from "@phoenix/pages/dataset/AddDatasetExampleButton";
import { useExamplesFilterContext } from "@phoenix/pages/examples/ExamplesFilterContext";
import { ExamplesSplitsMenu } from "@phoenix/pages/examples/ExamplesSplitsMenu";
import { generateUUID } from "@phoenix/utils/uuidUtils";

import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";
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

// Compact invalid-cell indicator — an icon + count rather than a wide prose
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
  const errorCount = useStore(editStore, getEditableTableErrorCount);
  const { added, updated, deleted } = useStore(
    editStore,
    useShallow(getEditableTableChangeCounts)
  );
  const isEditing = mode !== "read";
  const isSaving = mode === "saving";
  const canSave = changeCount > 0 && errorCount === 0 && !isSaving;
  // Cmd+S / Ctrl+S opens the save dialog while editing
  useEffect(() => {
    if (!isEditing) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "s"
      ) {
        return;
      }
      // A dialog owns its own shortcuts — a cell's JSON editor saves the cell
      // with Cmd+Enter — so don't stack the save dialog on top of one.
      const target = event.target;
      if (target instanceof Element && target.closest('[role="dialog"]')) {
        return;
      }
      event.preventDefault();
      if (canSave) {
        setIsSaveDialogOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isEditing, canSave]);
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
              {errorCount > 0 ? (
                <TooltipTrigger>
                  <TriggerWrap>
                    <span
                      css={diffStatErrorCSS}
                      aria-label={`${errorCount} invalid cell${
                        errorCount === 1 ? "" : "s"
                      }`}
                    >
                      <Icon svg={<Icons.AlertCircle />} color="danger" />
                      <Text color="danger">{errorCount}</Text>
                    </span>
                  </TriggerWrap>
                  <Tooltip>
                    {`${errorCount} invalid cell${
                      errorCount === 1 ? "" : "s"
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
              size="M"
              leadingVisual={<Icon svg={<Icons.Edit />} />}
              onPress={() => {
                setSelectedExampleIds([]);
                editStore.getState().beginEditing();
              }}
            >
              Edit examples
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
          <Dialog>
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
              <View
                paddingEnd="size-200"
                paddingTop="size-100"
                paddingBottom="size-100"
                borderTopColor="default"
                borderTopWidth="thin"
              >
                <Flex direction="row" justifyContent="end" gap="size-100">
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
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
      <SaveDatasetExamplesDialog
        datasetId={datasetId}
        editStore={editStore}
        isOpen={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
      />
    </View>
  );
};
