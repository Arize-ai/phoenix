import React, { HTMLProps } from "react";
import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";
import { SizingProps, StylableProps } from "@phoenix/components/types";
import { useTheme } from "@phoenix/contexts";

interface TokenProps
  extends Omit<HTMLProps<HTMLDivElement>, "size" | "css">,
    StylableProps,
    SizingProps {
  children?: React.ReactNode;
  /**
   * Whether the token is disabled
   */
  isDisabled?: boolean;
  /**
   * The color of the token.
   *
   * Can be any valid CSS color value, including CSS variables.
   */
  color?: string;
  /**
   * The function to call when the token is pressed
   */
  onPress?: () => void;
  /**
   * The function to call when the token is removed.
   *
   * If provided, an icon button will be displayed to the right of the token.
   */
  onRemove?: () => void;
}

const tokenBaseCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--ac-global-dimension-static-size-100);
  font-size: var(--ac-global-dimension-static-font-size-100);
  line-height: 20px;
  padding: var(--ac-global-dimension-static-size-50)
    var(--ac-global-dimension-static-size-100);
  border-radius: var(--ac-global-rounding-medium);
  border: 1px solid
    lch(from var(--ac-internal-token-color) calc((l) * infinity) c h / 0.3);
  color: lch(from var(--ac-internal-token-color) calc((50 - l) * infinity) 0 0);
  user-select: none;

  &[data-size="S"] {
    padding: var(--ac-global-dimension-static-size-25)
      var(--ac-global-dimension-static-size-50);
  }

  &[data-size="M"] {
    padding: var(--ac-global-dimension-static-size-50)
      var(--ac-global-dimension-static-size-100);
  }

  &[data-size="L"] {
    padding: var(--ac-global-dimension-static-size-100)
      var(--ac-global-dimension-static-size-200);
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &[data-theme="light"] {
    background: var(--ac-internal-token-color);
  }

  &[data-theme="dark"] {
    // generate a new dark token bg color from the input color
    --px-internal-dark-token-bg: lch(
      from var(--ac-internal-token-color) l c h / calc(alpha - 0.8)
    );
    background: var(--px-internal-dark-token-bg);
    // generate a new dark token text color from the input color
    color: lch(
      from var(--px-internal-dark-token-bg) calc((l) * infinity) c h / 1
    );
  }

  &[data-interactive]:not([data-disabled]) {
    cursor: pointer;

    > button {
      &:focus-visible {
        outline: 2px solid var(--ac-focus-ring-color);
        border-radius: var(--ac-global-rounding-small);
      }
    }
  }

  > button {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;

    &[disabled] {
      cursor: not-allowed;
    }
  }
`;

/**
 * A token is a pill or tag-like component that can display a string of text with optional interactions.
 * It can take one of four forms:
 * 1. Default: Wrapped child content
 * 2. Interactive: Wrapped button with child content that can be clicked (onPress)
 * 3. Removable: Wrapped child content, sibling to a remove button (onRemove)
 * 4. Full Interactive: Wrapped sibling buttons with child content in the non-remove button
 */
function Token({
  children,
  isDisabled,
  css: cssProp,
  color = "var(--ac-global-color-grey-300)",
  onPress,
  onRemove,
  size = "M",
  style,
  ...rest
}: TokenProps): JSX.Element {
  const { theme } = useTheme();

  const renderContent = () => {
    if (onPress && onRemove) {
      return (
        <>
          <button
            onClick={() => {
              onPress();
            }}
            disabled={isDisabled}
          >
            {children}
          </button>
          <button
            onClick={() => {
              onRemove();
            }}
            disabled={isDisabled}
            aria-label="Remove"
          >
            <Icon svg={<Icons.CloseOutline />} />
          </button>
        </>
      );
    }

    if (onPress) {
      return (
        <button
          onClick={() => {
            onPress();
          }}
          disabled={isDisabled}
        >
          {children}
        </button>
      );
    }

    if (onRemove) {
      return (
        <>
          <span>{children}</span>
          <button
            onClick={() => {
              onRemove();
            }}
            disabled={isDisabled}
            aria-label="Remove"
          >
            <Icon svg={<Icons.CloseOutline />} />
          </button>
        </>
      );
    }

    return children;
  };

  return (
    <div
      css={css(tokenBaseCSS, cssProp)}
      // @ts-expect-error --px-token-color is a custom property
      style={{ "--ac-internal-token-color": color, ...style }}
      data-theme={theme}
      data-size={size}
      {...(onPress && { "data-interactive": true })}
      {...(onRemove && { "data-removable": true })}
      {...(isDisabled && { "data-disabled": true })}
      {...rest}
    >
      {renderContent()}
    </div>
  );
}

export { Token };
export type { TokenProps };
