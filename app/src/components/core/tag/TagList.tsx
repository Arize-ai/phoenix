import { css } from "@emotion/react";
import type { Ref } from "react";
import { forwardRef, type JSX } from "react";
import type { TagListProps } from "react-aria-components";
import { TagList as AriaTagList } from "react-aria-components";

const tagListCSS = css`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-50);
  height: 28px;
`;
function TagList<T extends object>(
  props: TagListProps<T>,
  ref: Ref<HTMLDivElement>
) {
  return <AriaTagList {...props} ref={ref} css={tagListCSS} />;
}

// Use forwardRef with the generic type to ensure the type propagates
const _TagList = forwardRef(TagList) as <T extends object>(
  props: TagListProps<T> & { ref?: Ref<HTMLDivElement> }
) => JSX.Element;

export { _TagList as TagList };
export type { TagListProps };
