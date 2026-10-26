import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { Flex } from "@phoenix/components";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import { DecisionVersionTagsConfigCard } from "@phoenix/pages/decision/DecisionVersionTagsConfigCard";
import type { PromptConfigLoaderData } from "@phoenix/pages/prompt/promptConfigLoader";
import { promptConfigLoaderQuery } from "@phoenix/pages/prompt/promptConfigLoader";

import type { promptConfigLoaderQuery as PromptConfigLoaderQuery } from "./__generated__/promptConfigLoaderQuery.graphql";
import { PromptDetailsMainColumn } from "./PromptDetailsAside";
import { PromptNotFound } from "./PromptNotFound";
import { PromptVersionTagsConfigCard } from "./PromptVersionTagsConfigCard";

export function PromptConfigPage() {
  const loaderData = useLoaderData<PromptConfigLoaderData>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery<PromptConfigLoaderQuery>({
    query: promptConfigLoaderQuery,
    queryRef: loaderData.queryRef,
  });
  const node = data.prompt;
  let content;
  switch (node.__typename) {
    case "Prompt":
      content = <PromptVersionTagsConfigCard prompt={node} />;
      break;
    case "Decision":
      content = <DecisionVersionTagsConfigCard decision={node} />;
      break;
    default:
      return <PromptNotFound />;
  }

  return (
    <Flex direction="row" height="100%">
      <PromptDetailsMainColumn>{content}</PromptDetailsMainColumn>
    </Flex>
  );
}
