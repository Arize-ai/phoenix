import { css } from "@emotion/react";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { View } from "@phoenix/components";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { PromptConfigLoaderData } from "@phoenix/pages/prompt/promptConfigLoader";
import { promptConfigLoaderQuery } from "@phoenix/pages/prompt/promptConfigLoader";

import type { promptConfigLoaderQuery as PromptConfigLoaderQuery } from "./__generated__/promptConfigLoaderQuery.graphql";
import { PromptDetails } from "./PromptDetails";
import { PROMPT_PAGE_ONE_COLUMN_MAX_WIDTH } from "./promptPageLayout";
import { PromptVersionTagsConfig } from "./PromptVersionTagsConfig";

const layoutCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-200);
  max-width: ${PROMPT_PAGE_ONE_COLUMN_MAX_WIDTH}px;
  margin-inline: auto;
  & > * {
    min-width: 0;
  }
`;

export function PromptConfigPage() {
  const loaderData = useLoaderData<PromptConfigLoaderData>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery<PromptConfigLoaderQuery>({
    query: promptConfigLoaderQuery,
    queryRef: loaderData.queryRef,
  });

  return (
    <View
      height="100%"
      overflow="auto"
      width="100%"
      data-testid="scroll-container"
    >
      <View padding="size-200">
        <div css={layoutCSS}>
          <PromptDetails prompt={data.prompt} />
          <PromptVersionTagsConfig prompt={data.prompt} />
        </div>
      </View>
    </View>
  );
}
