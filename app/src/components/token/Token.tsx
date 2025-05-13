import React, { HTMLProps } from "react";
import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";
import { SizingProps, StylableProps } from "@phoenix/components/types";
import { useTheme } from "@phoenix/contexts";

interface TokenProps
  extends Omit<HTMLProps<HTMLDivElement>, "size" | "css" | "onClick">,
    StylableProps,
    SizingProps {
  children?: React.ReactNode;
  /**
   * Leading visual element
   */
  leadingVisual?: React.ReactNode;
  /**
   * Whether the token is disabled
   */
  isDisabled?: boolean;
  /**
   * The color of the token.
   *
   * Can be any valid CSS color value, including CSS variables.
   *
   * @default "var(--ac-global-color-grey-300)"
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
  font-size: var(--ac-global-dimension-static-font-size-75);
  line-height: var(--ac-global-line-height-s);
  padding: 0 var(--ac-global-dimension-static-size-100);
  border-radius: var(--ac-global-rounding-large);
  border: 1px solid
    lch(from var(--ac-internal-token-color) calc((l) * infinity) c h / 0.3);
  color: lch(from var(--ac-internal-token-color) calc((50 - l) * infinity) 0 0);
  user-select: none;

  &[data-size="S"] {
    height: var(--ac-global-dimension-static-size-200);
  }

  &[data-size="M"] {
    height: var(--ac-global-dimension-static-size-250);
  }

  &[data-size="L"] {
    height: var(--ac-global-dimension-static-size-300);
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &[data-theme="light"] {
    background: var(--ac-internal-token-color);
    border-color: var(--ac-internal-token-color);
  }

  &[data-theme="dark"] {
    // generate a new dark token bg color from the input color
    --scoped-token-dark-bg: lch(
      from var(--ac-internal-token-color) l c h / calc(alpha - 0.8)
    );
    background: var(--scoped-token-dark-bg);
    // generate a new dark token text color from the input color
    color: lch(from var(--scoped-token-dark-bg) calc((l) * infinity) c h / 1);
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

  &[data-removable] {
    padding-right: var(--ac-global-dimension-static-size-25);
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

function TokenLeadingVisual({
  children,
  size = "M",
}: React.PropsWithChildren<SizingProps>) {
  return (
    <span
      data-size={size}
      css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--ac-global-dimension-static-size-200);
        height: var(--ac-global-dimension-static-size-200);

        &[data-size="M"] {
          margin-right: var(--ac-global-dimension-static-size-50);
        }

        &[data-size="L"] {
          margin-right: var(--ac-global-dimension-static-size-100);
        }
      `}
    >
      {children}
    </span>
  );
}

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
  leadingVisual,
  ...rest
}: TokenProps) {
  const { theme } = useTheme();

  /**
   * Leading visual is only displayed for non-small tokens
   */
  const wrappedLeadingVisual =
    leadingVisual && size !== "S" ? (
      <TokenLeadingVisual size={size}>{leadingVisual}</TokenLeadingVisual>
    ) : null;

  const removeButton = onRemove ? (
    <button
      onClick={() => {
        onRemove();
      }}
      disabled={isDisabled}
      aria-label="Remove"
    >
      <Icon svg={<Icons.CloseOutline />} />
    </button>
  ) : null;

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
            {wrappedLeadingVisual}
            {children}
          </button>
          {removeButton}
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
          {wrappedLeadingVisual}
          {children}
        </button>
      );
    }

    if (onRemove) {
      return (
        <>
          <span>
            {wrappedLeadingVisual}
            {children}
          </span>
          {removeButton}
        </>
      );
    }

    return (
      <>
        {wrappedLeadingVisual}
        {children}
      </>
    );
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
