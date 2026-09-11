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
import type { EditableTableStore } from "@phoenix/components/table";
import { useNotifyError } from "@phoenix/contexts";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { AddDatasetExampleButton } from "@phoenix/pages/dataset/AddDatasetExampleButton";
import { useExamplesFilterContext } from "@phoenix/pages/examples/ExamplesFilterContext";
import { ExamplesSplitsMenu } from "@phoenix/pages/examples/ExamplesSplitsMenu";

import type { DatasetExampleTableRow } from "./datasetExampleTableTypes";

/**
 * The top bar of the examples tab: search plus the read-mode actions. While an
 * edit session is open the actions move to the floating edit toolbar, so this
 * bar only keeps the (paused) search in place.
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
            placeholder={
              isEditing
                ? "Search is paused while editing"
                : "Search examples by input, output, or metadata"
            }
            aria-label="Search examples"
            // Filtering refetches the baseline rows. An edited or deleted row
            // that falls out of the new filter would vanish from the table while
            // still being committed on save, so searching waits until the edit
            // session ends.
            isDisabled={isEditing}
          />
        </View>
        {isEditing ? null : (
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
          </Flex>
        )}
      </Flex>
    </View>
  );
};
