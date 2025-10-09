import { useParams } from "react-router";
import invariant from "tiny-invariant";

import { DebouncedSearch, Flex, View } from "@phoenix/components";
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
  } = useExamplesFilterContext();
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");
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
        <Flex gap="size-100" alignItems="center">
          <ExamplesSplitMenu
            datasetId={datasetId}
            onSelectionChange={setSelectedSplitIds}
            onExampleSelectionChange={setSelectedExampleIds}
            selectedSplitIds={selectedSplitIds}
            selectedExampleIds={selectedExampleIds}
          />
        </Flex>
      </Flex>
    </View>
  );
};
