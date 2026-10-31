import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import { graphql, useFragment } from "react-relay";

import type { TokenProps } from "@phoenix/components";
import { Text, Token } from "@phoenix/components";
import { getPromptVersionTagColor } from "@phoenix/constants/promptConstants";

import type { PromptVersionTagsList_data$key } from "./__generated__/PromptVersionTagsList_data.graphql";

const tagsListCSS = css`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--global-dimension-size-50);
  min-width: 0;
  .prompt-version-tags-list__action {
    display: flex;
  }
  .prompt-version-tags-list__empty {
    cursor: pointer;
  }
`;

/**
 * The version's tags, led by an optional control for editing them. With the
 * control and no tags, the row reads "No tags", and pressing that text presses
 * the control.
 */
export function PromptVersionTagsList({
  promptVersion,
  action,
}: {
  promptVersion: PromptVersionTagsList_data$key;
  action?: ReactNode;
}) {
  const actionRef = useRef<HTMLSpanElement>(null);
  const data = useFragment<PromptVersionTagsList_data$key>(
    graphql`
      fragment PromptVersionTagsList_data on PromptVersion {
        tags {
          id
          name
        }
      }
    `,
    promptVersion
  );

  return (
    <div css={tagsListCSS}>
      {action && (
        <span className="prompt-version-tags-list__action" ref={actionRef}>
          {action}
        </span>
      )}
      {data.tags.map((tag) => (
        <TagVersionLabel key={tag.id}>{tag.name}</TagVersionLabel>
      ))}
      {action &&
        data.tags.length === 0 && (
          // React Aria treats element.click() as a virtual press
          <span
            className="prompt-version-tags-list__empty"
            onClick={() => actionRef.current?.querySelector("button")?.click()}
          >
            <Text size="S" color="text-500">
              No tags
            </Text>
          </span>
        )}
    </div>
  );
}

export function TagVersionLabel({
  children,
  maxWidth,
  size = "M",
}: {
  children: string;
  maxWidth?: TokenProps["maxWidth"];
  size?: TokenProps["size"];
}) {
  const color: TokenProps["color"] = useMemo(
    () => getPromptVersionTagColor(children),
    [children]
  );
  return (
    <Token size={size} color={color} maxWidth={maxWidth} title={children}>
      {children}
    </Token>
  );
}
