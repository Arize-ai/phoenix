import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { PromptsTableProvider } from "@phoenix/contexts/PromptsTableContext";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import { PromptsFilterProvider } from "@phoenix/pages/prompts/PromptsFilterProvider";
import type { PromptsLoaderType } from "@phoenix/pages/prompts/promptsLoader";
import { promptsLoaderGql } from "@phoenix/pages/prompts/promptsLoader";

import { PromptsTable } from "./PromptsTable";

export function PromptsPage() {
  const loaderData = useLoaderData<PromptsLoaderType>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery({
    query: promptsLoaderGql,
    queryRef: loaderData,
  });

  return (
    <PromptsFilterProvider>
      <PromptsTableProvider>
        <PromptsTable query={data} />
      </PromptsTableProvider>
    </PromptsFilterProvider>
  );
}
