import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { PromptsFilterBar } from "@phoenix/features/prompts-settings/pages/prompts/PromptsFilterBar";
import { PromptsFilterProvider } from "@phoenix/features/prompts-settings/pages/prompts/PromptsFilterProvider";
import type { PromptsLoaderType } from "@phoenix/features/prompts-settings/pages/prompts/promptsLoader";
import { promptsLoaderGql } from "@phoenix/features/prompts-settings/pages/prompts/promptsLoader";

import { PromptsTable } from "./PromptsTable";

export function PromptsPage() {
  const loaderData = useLoaderData<PromptsLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery(promptsLoaderGql, loaderData);

  return (
    <PromptsFilterProvider>
      <Flex direction="column" height="100%">
        <PromptsFilterBar />
        <PromptsTable query={data} />
      </Flex>
    </PromptsFilterProvider>
  );
}
