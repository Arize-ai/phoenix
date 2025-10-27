import { Ref } from "react";
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
  box-sizing: border-box;

  &[data-focus-visible] {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: -1px;
  }

  &[data-empty] {
    align-items: center;
    justify-content: center;
    font-style: italic;
    color: var(--ac-global-text-color-700);
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
    line-height: var(--ac-global-line-height-s);

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

export interface ListBoxProps<T> extends AriaListBoxProps<T>, StylableProps {
  ref?: Ref<HTMLDivElement>;
}

export function ListBox<T extends object>(props: ListBoxProps<T>) {
  const { css: propsCSS, ref, ...restProps } = props;
  const mergedCSS = css(listBoxCSS, propsCSS);
  return <AriaListBox css={mergedCSS} ref={ref} {...restProps} />;
}
