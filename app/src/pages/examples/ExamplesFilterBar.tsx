import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { DebouncedSearch, Flex, View } from "@phoenix/components";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { useExamplesFilterContext } from "@phoenix/pages/examples/ExamplesFilterContext";
import { ExamplesSplitMenu } from "@phoenix/pages/examples/ExamplesSplitMenu";

export const ExamplesFilterBar = () => {
  const {
    setFilter,
    filter,
    selectedSplitIds,
    setSelectedSplitIds,
    selectedExampleIds,
    setSelectedExampleIds,
    examplesCache,
  } = useExamplesFilterContext();
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");
  const isSplitsEnabled = useFeatureFlag("datasetSplitsUI");
  return (
    <View padding="size-100">
      <Flex
        width="100%"
        justifyContent="space-between"
        gap="size-100"
        alignItems="center"
        wrap="nowrap"
      >
        <DebouncedSearch
          defaultValue={filter}
          onChange={setFilter}
          placeholder="Search examples by input, output, or metadata"
          aria-label="Search examples"
        />
        {isSplitsEnabled && (
          <Flex gap="size-100" alignItems="center">
            <ExamplesSplitMenu
              onSelectionChange={setSelectedSplitIds}
              onExampleSelectionChange={setSelectedExampleIds}
              selectedSplitIds={selectedSplitIds}
              selectedExampleIds={selectedExampleIds}
              examplesCache={examplesCache}
            />
          </Flex>
        )}
      </Flex>
    </View>
  );
};
