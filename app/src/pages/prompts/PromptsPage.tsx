import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { promptsLoaderQuery } from "@phoenix/pages/prompts/__generated__/promptsLoaderQuery.graphql";
import { PromptsFilterBar } from "@phoenix/pages/prompts/PromptsFilterBar";
import { PromptsFilterProvider } from "@phoenix/pages/prompts/PromptsFilterProvider";
import type { PromptsLoaderType } from "@phoenix/pages/prompts/promptsLoader";
import { promptsLoaderGql } from "@phoenix/pages/prompts/promptsLoader";

import { PromptsTable } from "./PromptsTable";

export function PromptsPage() {
  const loaderData = useLoaderData<PromptsLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery<promptsLoaderQuery>({
    query: promptsLoaderGql,
    queryRef: loaderData,
  });

  return (
    <PromptsFilterProvider>
      <Flex direction="column" height="100%">
        <PromptsFilterBar />
        <PromptsTable query={data} />
      </Flex>
    </PromptsFilterProvider>
  );
}
