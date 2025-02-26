import React from "react";
import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";
import { StylableProps } from "@phoenix/components/types";

// Define the base props that all token variants share
interface BaseTokenProps extends StylableProps {
  children?: React.ReactNode;
  /**
   * Whether the token is disabled
   */
  isDisabled?: boolean;
  /**
   * The color of the token
   */
  color?: string;
}

// Props for interactive token (button variant)
interface InteractiveTokenProps extends BaseTokenProps {
  onPress: () => void;
  onRemove?: never;
}

// Props for removable token
interface RemovableTokenProps extends BaseTokenProps {
  onRemove: () => void;
  onPress?: never;
}

// Props for token with both interactions
interface FullInteractiveTokenProps extends BaseTokenProps {
  onPress: () => void;
  onRemove: () => void;
}

// Union type of all possible token props
type TokenProps =
  | BaseTokenProps
  | InteractiveTokenProps
  | RemovableTokenProps
  | FullInteractiveTokenProps;

const tokenBaseCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--ac-global-dimension-static-size-100);
  font-size: var(--ac-global-dimension-static-font-size-100);
  line-height: 20px;
  padding: var(--ac-global-dimension-static-size-50)
    var(--ac-global-dimension-static-size-100);
  border-radius: var(--ac-global-rounding-medium);
  border: 1px solid lch(from var(--px-token-color) calc(l - 15) c h);
  background: var(--px-token-color);
  color: lch(from var(--px-token-color) calc((50 - l) * infinity) 0 0);
  user-select: none;

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &[data-interactive]:not([data-disabled]) {
    cursor: pointer;
    transition: all 0.2s ease-in-out;

    &:hover {
      background: lch(from var(--px-token-color) calc(l - 5) c h);
      border-color: lch(from var(--px-token-color) calc(l - 30) c h);
    }
  }

  > button {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    opacity: 0.8;
    transition: opacity 0.2s ease-in-out;

    &:hover:not([disabled]) {
      opacity: 1;
    }

    &[disabled] {
      cursor: not-allowed;
    }
  }
`;

/**
 * A token is a pill or tag-like component that can display a string of text with optional interactions.
 * It can take one of four forms:
 * 1. Default: A simple div with text content
 * 2. Interactive: A button that can be clicked (onPress)
 * 3. Removable: A div with a remove button (onRemove)
 * 4. Full Interactive: A div with sibling interactive and remove buttons
 */
function Token(props: TokenProps): JSX.Element {
  const {
    children,
    isDisabled,
    css: cssProp,
    color = "var(--ac-global-input-field-background-color)",
  } = props;
  const hasPress = "onPress" in props && props.onPress;
  const hasRemove = "onRemove" in props && props.onRemove;

  // Case 1: No interactions - simple div
  if (!hasPress && !hasRemove) {
    return (
      <div
        css={css(tokenBaseCSS, cssProp)}
        // @ts-expect-error --px-token-color is a custom property
        style={{ "--px-token-color": color }}
        {...(isDisabled && { "data-disabled": true })}
      >
        {children}
      </div>
    );
  }

  // Case 2: Interactive only - single button
  if (hasPress && !hasRemove) {
    return (
      <div
        css={css(tokenBaseCSS, cssProp)}
        // @ts-expect-error --px-token-color is a custom property
        style={{ "--px-token-color": color }}
        data-interactive
        {...(isDisabled && { "data-disabled": true })}
      >
        <button
          onClick={() => {
            if (!isDisabled) {
              props.onPress();
            }
          }}
          disabled={isDisabled}
        >
          {children}
        </button>
      </div>
    );
  }

  // Case 3: Removable only - div with remove button
  if (!hasPress && hasRemove) {
    return (
      <div
        css={css(tokenBaseCSS, cssProp)}
        // @ts-expect-error --px-token-color is a custom property
        style={{ "--px-token-color": color }}
        {...(isDisabled && { "data-disabled": true })}
      >
        <span>{children}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            props.onRemove();
          }}
          disabled={isDisabled}
          aria-label="Remove"
        >
          <Icon svg={<Icons.CloseOutline />} />
        </button>
      </div>
    );
  }

  // Case 4: Both interactions - wrapper div with sibling buttons
  return (
    <div
      css={css(tokenBaseCSS, cssProp)}
      // @ts-expect-error --px-token-color is a custom property
      style={{ "--px-token-color": color }}
      data-interactive
      {...(isDisabled && { "data-disabled": true })}
    >
      <button
        onClick={() => {
          if (!isDisabled) {
            props.onPress();
          }
        }}
        disabled={isDisabled}
      >
        {children}
      </button>
      <button
        onClick={() => {
          props.onRemove();
        }}
        disabled={isDisabled}
        aria-label="Remove"
      >
        <Icon svg={<Icons.CloseOutline />} />
      </button>
    </div>
  );
}

export { Token };
export type { TokenProps };
