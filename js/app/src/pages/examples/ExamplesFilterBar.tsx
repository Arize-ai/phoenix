import { css } from "@emotion/react";
import { useState } from "react";
import { useParams } from "react-router";
import invariant from "tiny-invariant";
import { useStore } from "zustand";

import {
  Button,
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import type { EditableTableStore } from "@phoenix/components/table";
import {
  getEditableTableChangeCount,
  getEditableTableErrorCount,
} from "@phoenix/components/table";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { AddDatasetExampleButton } from "@phoenix/pages/dataset/AddDatasetExampleButton";
import { useExamplesFilterContext } from "@phoenix/pages/examples/ExamplesFilterContext";
import { ExamplesSplitsMenu } from "@phoenix/pages/examples/ExamplesSplitsMenu";

import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";
import { SaveDatasetExamplesDialog } from "./SaveDatasetExamplesDialog";

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
  const mode = useStore(editStore, (state) => state.mode);
  const changeCount = useStore(editStore, getEditableTableChangeCount);
  const errorCount = useStore(editStore, getEditableTableErrorCount);
  const isEditing = mode !== "read";
  const isSaving = mode === "saving";
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
            <Text
              css={css`
                white-space: nowrap;
              `}
            >
              {changeCount} change{changeCount === 1 ? "" : "s"}
            </Text>
            <Button
              size="M"
              isDisabled={isSaving}
              leadingVisual={<Icon svg={<Icons.Plus />} />}
              onPress={() => {
                editStore.getState().addRow({
                  id: `new-${crypto.randomUUID()}`,
                  externalId: null,
                  splits: [],
                  input: {},
                  output: {},
                  metadata: {},
                  isNew: true,
                });
              }}
            >
              Add row
            </Button>
            <Button
              size="M"
              isDisabled={isSaving}
              onPress={() => editStore.getState().cancelEditing()}
            >
              Cancel
            </Button>
            <Button
              variant={changeCount > 0 ? "primary" : "default"}
              size="M"
              isDisabled={changeCount === 0 || errorCount > 0 || isSaving}
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
      <SaveDatasetExamplesDialog
        datasetId={datasetId}
        editStore={editStore}
        isOpen={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
      />
    </View>
  );
};
