import { css } from "@emotion/react";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { View } from "@phoenix/components";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { PromptConfigLoaderData } from "@phoenix/pages/prompt/promptConfigLoader";
import { promptConfigLoaderQuery } from "@phoenix/pages/prompt/promptConfigLoader";

import type { promptConfigLoaderQuery as PromptConfigLoaderQuery } from "./__generated__/promptConfigLoaderQuery.graphql";
import { PromptDetails } from "./PromptDetails";
import {
  PROMPT_PAGE_ONE_COLUMN_MAX_WIDTH,
  PROMPT_PAGE_TWO_COLUMN_MAX_WIDTH,
  PROMPT_PAGE_TWO_COLUMN_MIN_WIDTH,
} from "./promptPageLayout";
import { PromptVersionTagsConfig } from "./PromptVersionTagsConfig";

/**
 * The prompt's details lead. In two columns the tags sit only as wide as their
 * content needs, up to the larger share of the row. The details take a width
 * from the space available within fixed bounds, never from their content, so
 * editing them in place does not change their width. The pair is centered like
 * the single column.
 */
const layoutCSS = css`
  container-type: inline-size;
  .prompt-config__layout {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-200);
    max-width: ${PROMPT_PAGE_ONE_COLUMN_MAX_WIDTH}px;
    margin-inline: auto;
  }
  .prompt-config__column {
    min-width: 0;
  }
  @container (min-width: ${PROMPT_PAGE_TWO_COLUMN_MIN_WIDTH}px) {
    .prompt-config__layout {
      flex-direction: row;
      align-items: flex-start;
      justify-content: center;
      max-width: ${PROMPT_PAGE_TWO_COLUMN_MAX_WIDTH}px;
    }
    .prompt-config__column--primary {
      flex: 0 1 auto;
      max-width: 60%;
    }
    .prompt-config__column--secondary {
      flex: 1 1 0;
      min-width: var(--global-dimension-size-4600);
      max-width: var(--global-dimension-size-8000);
    }
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
          <div className="prompt-config__layout">
            <div className="prompt-config__column prompt-config__column--secondary">
              <PromptDetails prompt={data.prompt} />
            </div>
            <div className="prompt-config__column prompt-config__column--primary">
              <PromptVersionTagsConfig prompt={data.prompt} />
            </div>
          </div>
        </div>
      </View>
    </View>
  );
}
