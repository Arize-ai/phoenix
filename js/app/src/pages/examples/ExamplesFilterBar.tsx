import { css } from "@emotion/react";
import { useParams } from "react-router";
import invariant from "tiny-invariant";
import { useStore } from "zustand";

import {
  Button,
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  View,
} from "@phoenix/components";
import { useNotifyError } from "@phoenix/contexts";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { AddDatasetExampleButton } from "@phoenix/pages/dataset/AddDatasetExampleButton";
import { useExamplesFilterContext } from "@phoenix/pages/examples/ExamplesFilterContext";
import { ExamplesSplitsMenu } from "@phoenix/pages/examples/ExamplesSplitsMenu";
import type { EditableTableStore } from "@phoenix/types/editableTable";

import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";

/**
 * The top bar of the examples tab: the search and split filters plus the
 * read-mode actions. The filters stay live during an edit session so the rows
 * to change can be found one search at a time; pending changes are keyed by
 * row ID in the edit store, so rows that a search hides keep their changes and
 * the edit toolbar counts them. The actions move to the floating edit toolbar
 * while a session is open.
 */
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
  const isEditing = useStore(editStore, (state) => state.mode !== "read");
  const isSaving = useStore(editStore, (state) => state.mode === "saving");
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");
  const datasetName = useDatasetContext((state) => state.datasetName);
  const refreshLatestVersion = useDatasetContext(
    (state) => state.refreshLatestVersion
  );
  const notifyError = useNotifyError();
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
            // The refetch that ends a save is the only data change the table
            // waits for, so the filters hold still until it lands.
            isDisabled={isSaving}
          />
        </View>
        <Flex direction="row" gap="size-100" alignItems="center" flexShrink={0}>
          <ExamplesSplitsMenu
            onSelectionChange={setSelectedSplitIds}
            selectedSplitIds={selectedSplitIds}
            isDisabled={isSaving}
          />
          {isEditing ? null : (
            <>
              <AddDatasetExampleButton
                datasetId={datasetId}
                datasetName={datasetName}
                onAddExampleCompleted={() => {
                  // The example is already saved; a failed refresh only leaves
                  // the table on the previous version.
                  refreshLatestVersion().catch(() => {
                    notifyError({
                      title: "Example added, but the table could not refresh",
                      message: "Reload the page to see the new example.",
                    });
                  });
                }}
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
            </>
          )}
        </Flex>
      </Flex>
    </View>
  );
};
