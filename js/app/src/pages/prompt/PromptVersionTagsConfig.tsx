import { css } from "@emotion/react";
import { graphql, useFragment } from "react-relay";

import { Label, Text } from "@phoenix/components";
import { Empty } from "@phoenix/components/core/empty";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";

import type { PromptVersionTagsConfig_data$key } from "./__generated__/PromptVersionTagsConfig_data.graphql";
import { DeletePromptVersionTagButton } from "./DeletePromptVersionTagButton";
import { PromptVersionSummary } from "./PromptVersionSummary";
import { TagVersionLabel } from "./PromptVersionTagsList";

const tagsSectionCSS = css(
  fieldBaseCSS,
  css`
    display: flex;
    flex-direction: column;
  `
);

/**
 * Each row keeps its delete action in view: the tag and the version it is
 * applied to wrap onto separate lines before the row would overflow, and the
 * list scrolls sideways only if even that cannot fit.
 */
const tagListCSS = css`
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: auto;
  > li + li {
    border-top: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }
  .prompt-version-tags__row {
    display: flex;
    align-items: flex-start;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-100) 0;
  }
  .prompt-version-tags__info {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--global-dimension-size-100) var(--global-dimension-size-200);
    flex: 1 1 auto;
    min-width: 0;
  }
  .prompt-version-tags__tag {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--global-dimension-size-50);
    flex: 1 1 var(--global-dimension-size-2000);
    min-width: 0;
  }
  .prompt-version-tags__applied-to {
    flex: 0 1 var(--global-dimension-size-4000);
    min-width: 0;
  }
  .prompt-version-tags__actions {
    flex: none;
    align-self: center;
  }
`;

export function PromptVersionTagsConfig({
  prompt,
}: {
  prompt: PromptVersionTagsConfig_data$key;
}) {
  const data = useFragment(
    graphql`
      fragment PromptVersionTagsConfig_data on Prompt {
        id
        versionTags {
          id
          name
          description
          promptVersion {
            id
            ...PromptVersionSummaryFragment
          }
        }
      }
    `,
    prompt
  );

  return (
    <section css={tagsSectionCSS}>
      <Label elementType="span">Tags</Label>
      {data.versionTags.length === 0 ? (
        <Empty message="No Tags" />
      ) : (
        <ul css={tagListCSS}>
          {data.versionTags.map((tag) => (
            <li key={tag.id} className="prompt-version-tags__row">
              <div className="prompt-version-tags__info">
                <div className="prompt-version-tags__tag">
                  <TagVersionLabel>{tag.name}</TagVersionLabel>
                  {tag.description ? (
                    <Text color="text-700" size="XS">
                      {tag.description}
                    </Text>
                  ) : null}
                </div>
                <div className="prompt-version-tags__applied-to">
                  <PromptVersionSummary
                    promptVersion={tag.promptVersion}
                    to={`/prompts/${data.id}/versions/${tag.promptVersion.id}`}
                    showTags={false}
                  />
                </div>
              </div>
              <div className="prompt-version-tags__actions">
                <DeletePromptVersionTagButton
                  promptVersionTagId={tag.id}
                  promptId={data.id}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
