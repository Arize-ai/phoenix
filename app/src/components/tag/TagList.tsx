import { forwardRef, Ref } from "react";
import { TagList as AriaTagList, TagListProps } from "react-aria-components";
import { css } from "@emotion/react";

const tagListCSS = css`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--ac-global-dimension-size-50);
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
