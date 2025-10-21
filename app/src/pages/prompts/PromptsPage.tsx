import { useEffect, useState } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import {
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  LinkButton,
  View,
} from "@phoenix/components";
import {
  promptsLoaderGql,
  PromptsLoaderType,
} from "@phoenix/pages/prompts/promptsLoader";

import { PromptsTable } from "./PromptsTable";

export function PromptsPage() {
  const [searchFilter, setSearchFilter] = useState("");
  const loaderData = useLoaderData<PromptsLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery(promptsLoaderGql, loaderData);
  useEffect(() => {
    return () => {
      loaderData.dispose();
    };
  }, [loaderData]);

  return (
    <Flex direction="column" height="100%">
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="grey-200"
        flex="none"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap="size-100"
        >
          <DebouncedSearch
            aria-label="Search prompts by name"
            onChange={setSearchFilter}
            placeholder="Search prompts by name"
          />
          <LinkButton
            size="M"
            leadingVisual={<Icon svg={<Icons.MessageSquareOutline />} />}
            variant="primary"
            to="/playground"
          >
            New Prompt
          </LinkButton>
        </Flex>
      </View>
      <PromptsTable query={data} searchFilter={searchFilter} />
    </Flex>
  );
}
