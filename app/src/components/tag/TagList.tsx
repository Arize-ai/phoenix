import React, { forwardRef, Ref } from "react";
import { TagList as AriaTagList, TagListProps } from "react-aria-components";
import { css } from "@emotion/react";

const tagListCSS = css`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ac-global-dimension-size-50);
  height: 28px;
`;
function TagList<T extends Record<string, unknown>>(
  props: TagListProps<T>,
  ref: Ref<HTMLDivElement>
) {
  return <AriaTagList {...props} ref={ref} css={tagListCSS} />;
}

const _TagList = forwardRef(TagList);
export { _TagList as TagList };
export type { TagListProps };
