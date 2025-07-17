import { forwardRef, Ref } from "react";
import { Tag as AriaTag, TagProps } from "react-aria-components";
import { css } from "@emotion/react";

const tagCSS = css`
  border: 1px solid var(--ac-global-border-color-light);
  forced-color-adjust: none;
  border-radius: var(--ac-global-rounding-small);
  padding: var(--ac-global-dimension-size-50)
    var(--ac-global-dimension-size-100);
  font-size: var(--ac-global-font-size-s);
  color: var(--ac-global-text-color-900);
  outline: none;
  cursor: default;
  display: flex;
  align-items: center;
  transition: all 200ms;

  &[data-hovered] {
    border-color: var(--ac-global-border-color-dark);
  }

  &[data-focus-visible] {
    outline: 1px solid var(--ac-global-color-primary);
    outline-offset: 1px;
  }

  &[data-selected] {
    border-color: var(--ac-global-color-primary);
    background: var(--ac-global-color-primary-700);
  }
`;
function Tag(props: TagProps, ref: Ref<HTMLDivElement>) {
  return <AriaTag {...props} ref={ref} css={tagCSS} />;
}

const _Tag = forwardRef(Tag);
export { _Tag as Tag };
export type { TagProps };
