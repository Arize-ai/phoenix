import { Suspense, useCallback, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { DebouncedSearch, Flex, Loading, View } from "@phoenix/components";

import { DatasetsPageQuery } from "./__generated__/DatasetsPageQuery.graphql";
import { DatasetsTable } from "./DatasetsTable";
import { NewDatasetActionMenu } from "./NewDatasetActionMenu";

export function DatasetsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DatasetsPageContent />
    </Suspense>
  );
}

export function DatasetsPageContent() {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<DatasetsPageQuery>(
    graphql`
      query DatasetsPageQuery {
        ...DatasetsTable_datasets
      }
    `,
    {},
    {
      fetchKey: fetchKey,
      fetchPolicy: "store-and-network",
    }
  );

  const onDatasetCreated = useCallback(() => {
    setFetchKey((prev) => prev + 1);
  }, [setFetchKey]);

  const [filter, setFilter] = useState<string>("");
  return (
    <Flex direction="column" height="100%">
      <View
        padding="size-200"
        flex="none"
        borderBottomWidth="thin"
        borderBottomColor="dark"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap="size-100"
        >
          <DebouncedSearch
            aria-label="Search datasets by name"
            onChange={setFilter}
            placeholder="Search datasets by name"
          />
          <View flex="none">
            <NewDatasetActionMenu onDatasetCreated={onDatasetCreated} />
          </View>
        </Flex>
      </View>
      <DatasetsTable query={data} filter={filter} />
    </Flex>
  );
}
