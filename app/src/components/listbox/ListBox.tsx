import { forwardRef, Ref } from "react";
import {
  ListBox as AriaListBox,
  ListBoxProps as AriaListBoxProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { StylableProps } from "../types";

const listBoxCSS = css`
  display: flex;
  flex-direction: column;
  max-height: inherit;
  overflow: auto;
  forced-color-adjust: none;
  outline: none;
  max-height: 300px;
  min-height: 100px;
  box-sizing: border-box;

  &[data-focus-visible] {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: -1px;
  }

  .react-aria-ListBoxItem {
    margin: var(--ac-global-dimension-size-25);
    padding: var(--ac-global-dimension-size-100)
      var(--ac-global-dimension-size-150);
    border-radius: var(--ac-global-rounding-small);
    outline: none;
    cursor: default;
    color: var(--ac-global-text-color-900);
    font-size: var(--ac-global-font-size-s);

    position: relative;
    display: flex;
    flex-direction: column;

    &[data-focus-visible] {
      outline: 2px solid var(--ac-focus-ring-color);
      outline-offset: -2px;
    }

    &[data-selected] {
      background: var(--ac-highlight-background);
      color: var(--ac-highlight-foreground);

      &[data-focus-visible] {
        outline-color: var(--ac-highlight-foreground);
        outline-offset: -4px;
      }
    }
    &[data-hovered],
    &[data-active] {
      background: var(--ac-global-background-color-light-hover);
    }
  }
`;

export interface ListBoxProps<T> extends AriaListBoxProps<T>, StylableProps {}

function ListBox<T extends object>(
  props: ListBoxProps<T>,
  ref: Ref<HTMLDivElement>
) {
  const { css: propsCSS, ...restProps } = props;
  const mergedCSS = css(listBoxCSS, propsCSS);
  return <AriaListBox css={mergedCSS} ref={ref} {...restProps} />;
}

const _ListBox = forwardRef(ListBox);
export { _ListBox as ListBox };
