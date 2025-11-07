import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { PromptsFilterBar } from "@phoenix/pages/prompts/PromptsFilterBar";
import { PromptsFilterProvider } from "@phoenix/pages/prompts/PromptsFilterProvider";
import {
  promptsLoaderGql,
  PromptsLoaderType,
} from "@phoenix/pages/prompts/promptsLoader";

import { PromptsTable } from "./PromptsTable";

export function PromptsPage() {
  const loaderData = useLoaderData<PromptsLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery(promptsLoaderGql, loaderData);

  return (
    <PromptsFilterProvider>
      <title>Prompts - Phoenix</title>
      <Flex direction="column" height="100%">
        <PromptsFilterBar />
        <PromptsTable query={data} />
      </Flex>
    </PromptsFilterProvider>
  );
}
