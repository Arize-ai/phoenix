import { css } from "@emotion/react";
import type { PropsWithChildren, Ref } from "react";

import { classNames } from "@phoenix/utils/classNames";

import { Button, type ButtonProps } from "../button";

const menuButtonCSS = css`
  justify-content: flex-start;
  min-width: 0;

  &:not([data-disabled="true"]) {
    &[data-pressed],
    &:hover {
      --button-border-color: var(--global-input-field-border-color-active);
    }
  }

  .menu-button__value {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-align: start;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .menu-button__value--placeholder {
    color: var(--text-color-placeholder);
    font-style: italic;
  }

  & > .icon-wrap:last-child {
    flex: none;
    margin-left: auto;
  }
`;

export type MenuButtonProps = ButtonProps & { ref?: Ref<HTMLButtonElement> };

/**
 * A button styled for use as a menu trigger when it displays the current
 * selection and a trailing affordance.
 */
export function MenuButton({ ref, css: propCSS, ...props }: MenuButtonProps) {
  return <Button ref={ref} css={css(menuButtonCSS, propCSS)} {...props} />;
}

/**
 * The text value shown inside a MenuButton. It truncates long selections and
 * can render placeholder styling before a selection has been made.
 */
export function MenuButtonValue({
  children,
  isPlaceholder,
}: PropsWithChildren<{ isPlaceholder?: boolean }>) {
  return (
    <span
      className={classNames(
        "menu-button__value",
        isPlaceholder && "menu-button__value--placeholder"
      )}
    >
      {children}
    </span>
  );
}
