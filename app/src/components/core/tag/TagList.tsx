import { css } from "@emotion/react";
import type { Ref } from "react";
import type { TagListProps } from "react-aria-components";
import { TagList as AriaTagList } from "react-aria-components";

const tagListCSS = css`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-50);
  height: 28px;
`;
function TagList<T extends object>({
  ref,
  ...props
}: TagListProps<T> & { ref?: Ref<HTMLDivElement> }) {
  return <AriaTagList {...props} ref={ref} css={tagListCSS} />;
}

export { TagList };
export type { TagListProps };
