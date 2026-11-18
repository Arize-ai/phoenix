import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Button as AriaButton } from "react-aria-components";

import { Icon, Icons } from "@phoenix/components/core/icon";
import { Tooltip, TooltipTrigger } from "@phoenix/components/core/tooltip";

const SHOW_COPIED_TIMEOUT_MS = 2000;

/**
 * Shorter values show whole; longer ones keep this many trailing characters
 * when they truncate, since an ID's end usually tells it apart from its
 * neighbors.
 */
const TAIL_LENGTH = 6;
const SPLIT_MIN_LENGTH = TAIL_LENGTH * 2;

export interface IdentifierProps {
  /**
   * The identifier exactly as a person would paste it: a trace ID, a span
   * ID, a global ID, a client ID. An empty value renders nothing.
   */
  value: string;
  /**
   * Makes the identifier a button that copies the value. Pass the noun it
   * copies ("trace ID"); it names the button ("Copy trace ID") and its
   * tooltip. Leave it out wherever the identifier sits inside another
   * control, such as a `Tag`, which owns the press.
   */
  copyNoun?: string;
  /**
   * The width past which the value truncates in the middle, keeping its
   * last characters. The full value stays in the native tooltip.
   */
  maxWidth?: CSSProperties["maxWidth"];
}

const identifierCSS = css`
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  max-width: var(--identifier-max-width, 100%);
  font-family: var(--global-font-family-mono);
  white-space: nowrap;
  vertical-align: baseline;

  .identifier__head {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .identifier__tail {
    flex: none;
  }
`;

const copyButtonCSS = css`
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  min-width: 0;
  max-width: 100%;
  margin: calc(-1 * var(--global-dimension-size-25))
    calc(-1 * var(--global-dimension-size-50));
  padding: var(--global-dimension-size-25) var(--global-dimension-size-50);
  border: none;
  border-radius: var(--global-rounding-small);
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  outline: none;

  .identifier__copy-icon {
    flex: none;
    font-size: 12px;
    color: var(--global-text-color-500);
  }
  &[data-hovered] {
    background-color: var(--hover-background);
    .identifier__copy-icon {
      color: var(--global-text-color-900);
    }
  }
  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
  &[data-copied] .identifier__copy-icon {
    color: var(--global-color-success);
  }
`;

function IdentifierText({
  value,
  maxWidth,
  hasTitle,
}: {
  value: string;
  maxWidth?: CSSProperties["maxWidth"];
  hasTitle: boolean;
}) {
  const isSplit = value.length >= SPLIT_MIN_LENGTH;
  return (
    <span
      className="identifier"
      css={identifierCSS}
      title={hasTitle ? value : undefined}
      style={
        maxWidth !== undefined
          ? ({ "--identifier-max-width": maxWidth } as CSSProperties)
          : undefined
      }
    >
      {isSplit ? (
        <>
          <span className="identifier__head">
            {value.slice(0, -TAIL_LENGTH)}
          </span>
          <span className="identifier__tail">{value.slice(-TAIL_LENGTH)}</span>
        </>
      ) : (
        <span className="identifier__head">{value}</span>
      )}
    </span>
  );
}

/**
 * An Identifier: the machine name of a thing, such as a trace ID, set in
 * monospace. It is not a member of the badge family: it has no container,
 * no color and no tone, because an ID classifies, counts and judges
 * nothing. It truncates in the middle and keeps its last characters, which
 * usually tell it apart from its neighbors.
 *
 * With a `copyNoun` it is a quiet button that copies the value, marked by a
 * trailing copy icon that turns into a check once copied. Anywhere it is
 * part of something else, as the name of a `Tag` for an object that has no
 * name of its own (a trace, a span), it is plain text.
 */
export function Identifier({ value, copyNoun, maxWidth }: IdentifierProps) {
  const [isCopied, setIsCopied] = useState(false);
  useEffect(() => {
    if (!isCopied) {
      return undefined;
    }
    const timeout = setTimeout(
      () => setIsCopied(false),
      SHOW_COPIED_TIMEOUT_MS
    );
    return () => clearTimeout(timeout);
  }, [isCopied]);

  if (value === "") {
    return null;
  }
  const text = (
    <IdentifierText
      value={value}
      maxWidth={maxWidth}
      hasTitle={copyNoun === undefined}
    />
  );
  if (copyNoun === undefined) {
    return text;
  }
  const copyLabel = `Copy ${copyNoun}`;
  return (
    <TooltipTrigger>
      <AriaButton
        className="identifier-copy"
        css={copyButtonCSS}
        aria-label={`${copyLabel} ${value}`}
        {...(isCopied && { "data-copied": true })}
        onPress={() => {
          copy(value);
          setIsCopied(true);
        }}
      >
        {text}
        <Icon
          className="identifier__copy-icon"
          svg={isCopied ? <Icons.Checkmark /> : <Icons.Duplicate />}
        />
      </AriaButton>
      <Tooltip offset={1}>{isCopied ? "Copied" : copyLabel}</Tooltip>
    </TooltipTrigger>
  );
}
