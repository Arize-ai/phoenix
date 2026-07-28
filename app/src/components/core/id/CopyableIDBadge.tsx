import copy from "copy-to-clipboard";
import { useLayoutEffect, useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";

import { Text } from "@phoenix/components/core/content";
import { Icon } from "@phoenix/components/core/icon";
import { Tooltip, TooltipTrigger } from "@phoenix/components/core/tooltip";
import type { ComponentSize } from "@phoenix/components/core/types";
import { classNames } from "@phoenix/utils/classNames";

import {
  copyableIDBadgeButtonCSS,
  copyableIDBadgeIconOnlyCSS,
  copyableIDBadgeTooltipCSS,
  SHOW_COPIED_TIMEOUT_MS,
} from "./styles";

type DisplayPhase = "idle" | "hover" | "copied";

type DisplayCharacter = {
  character: string;
  opacity?: number;
};

export type CopyableIDBadgeOverflowMode = "visible" | "truncate";

/**
 * Opacity ramp applied to the ID characters that trail the copy/copied label.
 * The character nearest the label starts nearly invisible and ramps to the
 * resting subdued amount, then holds steady.
 */
const FADE_START_OPACITY = 0.1;
const FADE_END_OPACITY = 0.4;
const FADE_STEPS = 4;

function getFadeOpacity(index: number): number {
  const progress = Math.min(index, FADE_STEPS - 1) / (FADE_STEPS - 1);
  return (
    FADE_START_OPACITY + (FADE_END_OPACITY - FADE_START_OPACITY) * progress
  );
}

/**
 * Splits the value into the affordance label and the remaining, dimmed ID
 * characters. The label overwrites the leading characters instead of being
 * appended, so a monospace value does not change width between phases.
 */
function getDisplaySegments({
  id,
  phase,
}: {
  id: string;
  phase: DisplayPhase;
}): { label: string; faded: string } {
  if (phase === "idle" || id.length < 4) {
    return { label: "", faded: id };
  }
  const label = phase === "copied" && id.length >= 6 ? "copied" : "copy";
  return { label, faded: id.slice(label.length) };
}

function getDisplayCharacters({
  id,
  phase,
}: {
  id: string;
  phase: DisplayPhase;
}): DisplayCharacter[] {
  const { label, faded } = getDisplaySegments({ id, phase });
  if (phase === "idle") {
    return Array.from(faded, (character) => ({ character }));
  }
  if (label === "") {
    return Array.from(faded, (character) => ({
      character,
      opacity: FADE_END_OPACITY,
    }));
  }
  return [
    ...Array.from(label, (character) => ({ character })),
    ...Array.from(faded, (character, index) => ({
      character,
      opacity: getFadeOpacity(index),
    })),
  ];
}

function renderDisplayCharacters({
  characters,
  segment,
}: {
  characters: DisplayCharacter[];
  segment: string;
}) {
  return characters.map(({ character, opacity }, index) => (
    <span
      key={`${segment}-${index}`}
      data-copyable-id-character
      style={opacity === undefined ? undefined : { opacity }}
    >
      {character}
    </span>
  ));
}

function renderTruncatedValue({
  id,
  phase,
  availableCharacterCount,
}: {
  id: string;
  phase: DisplayPhase;
  availableCharacterCount: number;
}) {
  const characters = getDisplayCharacters({ id, phase });
  if (availableCharacterCount >= characters.length) {
    return renderDisplayCharacters({ characters, segment: "full" });
  }

  const isWideTruncation = availableCharacterCount >= 9;
  let prefixLength: number;
  let suffixLength: number;
  let shouldShowEllipsis: boolean;

  if (isWideTruncation) {
    const visibleCharacterCount = availableCharacterCount - 1;
    prefixLength = Math.ceil(visibleCharacterCount / 2);
    suffixLength = Math.floor(visibleCharacterCount / 2);
    shouldShowEllipsis = true;
  } else {
    const preferredPrefixLength =
      phase === "idle" ? 3 : phase === "hover" ? 4 : 6;
    prefixLength = Math.min(preferredPrefixLength, availableCharacterCount);
    const remainingCharacterCount = availableCharacterCount - prefixLength;
    shouldShowEllipsis = remainingCharacterCount > 0 && phase === "idle";
    const ellipsisCharacterCount = shouldShowEllipsis ? 1 : 0;
    suffixLength = Math.min(
      2,
      Math.max(remainingCharacterCount - ellipsisCharacterCount, 0)
    );
  }
  const ellipsisOpacity = phase === "idle" ? undefined : FADE_END_OPACITY;

  return (
    <>
      <span className="copyable-id-badge__prefix">
        {renderDisplayCharacters({
          characters: characters.slice(0, prefixLength),
          segment: "truncated-prefix",
        })}
      </span>
      {shouldShowEllipsis ? (
        <span
          className="copyable-id-badge__ellipsis"
          style={
            ellipsisOpacity === undefined
              ? undefined
              : { opacity: ellipsisOpacity }
          }
        >
          …
        </span>
      ) : null}
      {suffixLength > 0 ? (
        <span className="copyable-id-badge__suffix">
          {renderDisplayCharacters({
            characters: characters.slice(-suffixLength),
            segment: "truncated-suffix",
          })}
        </span>
      ) : null}
    </>
  );
}

export interface CopyableIDBadgeProps {
  /** The ID value to display and copy to the clipboard. */
  id: string;
  /**
   * The size of the icon. The ID text remains the standard metadata size.
   * @default "S"
   */
  size?: ComponentSize;
  /**
   * Whether to display the ID value alongside the icon.
   * @default true
   */
  showValue?: boolean;
  /**
   * Whether a long ID remains fully visible or truncates in constrained space.
   * @default "visible"
   */
  overflowMode?: CopyableIDBadgeOverflowMode;
  /**
   * The accessible label for the copy action.
   * @default "Copy ID"
   */
  tooltipText?: string;
}

/**
 * Displays an entity ID as quiet metadata and copies it when pressed.
 *
 * At rest, an ID icon leads the value. On hover, the icon becomes a copy icon
 * and the leading characters become a stable-width "copy" label. After a
 * press, those affordances become a success checkmark and "copied" label.
 */
export function CopyableIDBadge({
  id,
  size = "S",
  showValue = true,
  overflowMode = "visible",
  tooltipText = "Copy ID",
}: CopyableIDBadgeProps) {
  const [isCopied, setIsCopied] = useState(false);
  const copiedTimeoutId = useRef<number | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const valueRef = useRef<HTMLElement>(null);
  const [availableCharacterCount, setAvailableCharacterCount] = useState<
    number | null
  >(null);
  // The visible badge already says "copy" on hover, so a native title is the
  // lighter-weight way to expose its ID. Enhance to a tooltip only when the
  // badge is too constrained to communicate that copy action in its content.
  const shouldShowTooltip = !showValue || id.length < 4;

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (button === null) {
      return;
    }
    if (shouldShowTooltip) {
      button.removeAttribute("title");
    } else {
      // React Aria intentionally filters the title prop, so apply the native
      // attribute directly without introducing a layout-affecting wrapper.
      button.setAttribute("title", id);
    }
  }, [id, shouldShowTooltip]);

  useLayoutEffect(() => {
    const valueElement = valueRef.current;
    if (
      overflowMode !== "truncate" ||
      !showValue ||
      id.length <= 8 ||
      valueElement === null
    ) {
      return undefined;
    }

    const measureAvailableCharacters = () => {
      const characterElement = valueElement.querySelector<HTMLElement>(
        "[data-copyable-id-character]"
      );
      if (characterElement === null) {
        return;
      }
      const valueWidth = valueElement.getBoundingClientRect().width;
      const characterWidth = characterElement.getBoundingClientRect().width;
      if (valueWidth <= 0 || characterWidth <= 0) {
        return;
      }
      const nextAvailableCharacterCount = Math.max(
        0,
        Math.floor(valueWidth / characterWidth)
      );
      setAvailableCharacterCount((currentCharacterCount) =>
        currentCharacterCount === nextAvailableCharacterCount
          ? currentCharacterCount
          : nextAvailableCharacterCount
      );
    };

    measureAvailableCharacters();
    const resizeObserver = new ResizeObserver(measureAvailableCharacters);
    resizeObserver.observe(valueElement);
    return () => resizeObserver.disconnect();
  }, [id, overflowMode, showValue]);

  const handlePress = () => {
    void copy(id);
    setIsCopied(true);
    window.clearTimeout(copiedTimeoutId.current);
    copiedTimeoutId.current = window.setTimeout(() => {
      setIsCopied(false);
    }, SHOW_COPIED_TIMEOUT_MS);
  };

  const copyButton = (
    <AriaButton
      ref={buttonRef}
      className="copyable-id-badge"
      css={copyableIDBadgeButtonCSS}
      data-overflow-mode={overflowMode}
      data-size={size}
      aria-label={`${tooltipText} ${id}`}
      onPress={handlePress}
    >
      {({ isHovered }) => {
        const phase: DisplayPhase = isCopied
          ? "copied"
          : isHovered
            ? "hover"
            : "idle";
        const { label, faded } = getDisplaySegments({ id, phase });
        const shouldMiddleTruncate =
          overflowMode === "truncate" && id.length > 8;
        const hasMeasuredTruncation =
          shouldMiddleTruncate && availableCharacterCount !== null;

        return (
          <>
            <Icon
              className="copyable-id-badge__icon"
              css={showValue ? undefined : copyableIDBadgeIconOnlyCSS}
              color={isCopied ? "success" : "inherit"}
              svgKey={
                phase === "copied"
                  ? "Checkmark"
                  : phase === "hover"
                    ? "Duplicate"
                    : "ID"
              }
            />
            {showValue ? (
              <Text
                ref={valueRef}
                className={classNames("copyable-id-badge__value", {
                  "copyable-id-badge__value--measured-truncated":
                    hasMeasuredTruncation,
                })}
                fontFamily="mono"
                size="S"
                color="text-500"
                width={
                  hasMeasuredTruncation
                    ? `${availableCharacterCount}ch`
                    : undefined
                }
              >
                {shouldMiddleTruncate ? (
                  hasMeasuredTruncation ? (
                    renderTruncatedValue({
                      id,
                      phase,
                      availableCharacterCount,
                    })
                  ) : (
                    renderDisplayCharacters({
                      characters: getDisplayCharacters({ id, phase }),
                      segment: "measuring",
                    })
                  )
                ) : phase === "idle" ? (
                  faded
                ) : label === "" ? (
                  <span style={{ opacity: FADE_END_OPACITY }}>{faded}</span>
                ) : (
                  <>
                    {label}
                    {faded.split("").map((character, index) => (
                      <span
                        key={`${index}-${character}`}
                        style={{ opacity: getFadeOpacity(index) }}
                      >
                        {character}
                      </span>
                    ))}
                  </>
                )}
              </Text>
            ) : null}
          </>
        );
      }}
    </AriaButton>
  );

  return shouldShowTooltip ? (
    <TooltipTrigger>
      {copyButton}
      <Tooltip css={copyableIDBadgeTooltipCSS} placement="right" offset={1}>
        {isCopied ? (
          "Copied"
        ) : (
          <>
            Copy <span className="copyable-id-badge__tooltip-id">{id}</span>
          </>
        )}
      </Tooltip>
    </TooltipTrigger>
  ) : (
    copyButton
  );
}
