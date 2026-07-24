import { css } from "@emotion/react";
import type { HTMLProps, Ref } from "react";
import React from "react";

import { useTheme } from "@phoenix/contexts";

import { Icon, Icons } from "../icon";
import type { SizingProps, StylableProps } from "../types";

interface TokenProps
  extends
    Omit<HTMLProps<HTMLDivElement>, "size" | "css" | "onClick">,
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
   * @default "var(--global-color-gray-600)"
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
  /**
   * Maximum width for the token. Text truncates with an ellipsis when exceeded.
   *
   * @default "var(--global-dimension-size-2000)" (160px)
   * @example "200px" | "100%" | "10ch"
   */
  maxWidth?: React.CSSProperties["maxWidth"];
}

const tokenBaseCSS = css`
  --token-max-width: var(--global-dimension-size-2000);
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  /* Keep the trailing gap (text → remove button) as tight as the leading
     visual's margin so the pill reads as one unit. */
  gap: var(--global-dimension-size-50);
  font-size: var(--global-dimension-font-size-75);
  line-height: var(--global-line-height-s);
  padding: 0 var(--global-dimension-size-100);
  border-radius: var(--global-rounding-large);
  border: 1px solid transparent;
  user-select: none;
  max-width: var(--token-max-width);

  .token__text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &[data-size="S"] {
    height: var(--global-dimension-size-200);
  }

  &[data-size="M"] {
    height: var(--global-dimension-size-250);
  }

  &[data-size="L"] {
    height: var(--global-dimension-size-300);
    /* The large token scales its typography up to body size so token-heavy
       detail views stay readable; S and M keep the compact font. */
    font-size: var(--global-dimension-font-size-100);
  }

  /* Center the leading visual and the remove button inside the pill's
     rounded end caps. A cap is a semicircle of radius height/2, so the 16px
     visual/icon box lands centered when the side inset is
     capRadius - 1px border - 8px (half the box). */
  &[data-size="M"][data-leading-visual] {
    padding-left: 1px;
  }

  &[data-size="L"][data-leading-visual] {
    padding-left: calc(var(--global-dimension-size-50) - 1px);
  }

  &[data-size="S"][data-removable] {
    padding-right: var(--global-dimension-size-25);
  }

  &[data-size="M"][data-removable] {
    padding-right: 1px;
  }

  &[data-size="L"][data-removable] {
    padding-right: calc(var(--global-dimension-size-50) - 1px);
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &[data-theme="light"] {
    background: lch(from var(--internal-token-color) 96 calc(c * 0.3) h);
    border-color: lch(from var(--internal-token-color) 88 calc(c * 0.4) h);
    color: lch(from var(--internal-token-color) 45 c h);
  }

  &[data-theme="dark"] {
    background: lch(from var(--internal-token-color) 18 calc(c * 0.2) h);
    border-color: lch(from var(--internal-token-color) 28 calc(c * 0.3) h);
    color: lch(from var(--internal-token-color) 90 calc(c * 0.8) h);
  }

  &[data-interactive]:not([data-disabled]) {
    cursor: pointer;

    > button {
      &:focus-visible {
        outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
        border-radius: var(--global-rounding-small);
      }
    }
  }

  > button {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;

    &[disabled] {
      cursor: not-allowed;
    }
  }
`;

function TokenLeadingVisual({ children }: React.PropsWithChildren) {
  return (
    <span
      css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--global-dimension-size-200);
        height: var(--global-dimension-size-200);
        /* The visual keeps its box when the token's text truncates —
           otherwise it compresses and the visual slides into the end cap. */
        flex-shrink: 0;
        margin-right: var(--global-dimension-size-50);
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
  ref,
  children,
  isDisabled,
  css: cssProp,
  color = "var(--global-color-gray-600)",
  onPress,
  onRemove,
  size = "M",
  style,
  leadingVisual,
  maxWidth,
  ...rest
}: TokenProps & { ref?: Ref<HTMLDivElement> }) {
  const { theme } = useTheme();

  /**
   * Leading visual is only displayed for non-small tokens
   */
  const wrappedLeadingVisual =
    leadingVisual && size !== "S" ? (
      <TokenLeadingVisual>{leadingVisual}</TokenLeadingVisual>
    ) : null;

  const removeButton = onRemove ? (
    <button
      onClick={() => {
        onRemove();
      }}
      disabled={isDisabled}
      aria-label="Remove"
    >
      <Icon svg={<Icons.Close />} />
    </button>
  ) : null;

  const textContent = <span className="token__text">{children}</span>;

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
            {textContent}
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
          {textContent}
        </button>
      );
    }

    if (onRemove) {
      return (
        <>
          <span>
            {wrappedLeadingVisual}
            {textContent}
          </span>
          {removeButton}
        </>
      );
    }

    return (
      <>
        {wrappedLeadingVisual}
        {textContent}
      </>
    );
  };

  return (
    <div
      ref={ref}
      css={css(tokenBaseCSS, cssProp)}
      style={{
        // @ts-expect-error custom CSS properties
        "--internal-token-color": color,
        ...(maxWidth && { "--token-max-width": maxWidth }),
        ...style,
      }}
      data-theme={theme}
      data-size={size}
      {...(onPress && { "data-interactive": true })}
      {...(onRemove && { "data-removable": true })}
      {...(wrappedLeadingVisual && { "data-leading-visual": true })}
      {...(isDisabled && { "data-disabled": true })}
      {...rest}
    >
      {renderContent()}
    </div>
  );
}

export { Token };
export type { TokenProps };
