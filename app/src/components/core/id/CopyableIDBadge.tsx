import copy from "copy-to-clipboard";
import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";

import { Badge } from "@phoenix/components/core/badge";
import { Text } from "@phoenix/components/core/content";
import { Icon } from "@phoenix/components/core/icon";
import type { ComponentSize } from "@phoenix/components/core/types";

import {
  copyableBadgeButtonCSS,
  copyableBadgeIconOnlyCSS,
  copyableBadgeWrapperCSS,
  SHOW_COPIED_TIMEOUT_MS,
} from "./styles";

type DisplayPhase = "idle" | "hover" | "copied";

/**
 * Opacity ramp applied to the id characters that trail the copy/copied label.
 * The char nearest the label starts at `FADE_START_OPACITY` (nearly invisible)
 * and ramps to `FADE_END_OPACITY` (the resting subdued amount) over `FADE_STEPS`
 * characters, then holds steady. Tweak these to adjust the fade.
 */
const FADE_START_OPACITY = 0.1;
const FADE_END_OPACITY = 0.4;
const FADE_STEPS = 4;

/**
 * Opacity for the trailing char at `index`, where `0` is the char immediately
 * after the label. Ramps linearly from start to end over `FADE_STEPS`, then
 * holds at `FADE_END_OPACITY`.
 */
function fadeOpacityAt(index: number): number {
  if (FADE_STEPS <= 1) {
    return FADE_END_OPACITY;
  }
  const progress = Math.min(index, FADE_STEPS - 1) / (FADE_STEPS - 1);
  return (
    FADE_START_OPACITY + (FADE_END_OPACITY - FADE_START_OPACITY) * progress
  );
}

/**
 * Splits the value into the affordance label (shown at full opacity, left
 * aligned) and the remaining, dimmed id characters. The label overwrites the
 * leading characters of the id rather than being appended, so the total
 * character count -- and therefore, in a mono font, the width -- never changes.
 *
 * - `< 4` chars: too short to fit a label (`label` empty), so the icon changes
 *   and the whole id dims to the resting subdued opacity (see the render).
 * - `4`/`5` chars: the label is "copy" for both hover and copied ("copied"
 *   would not fit).
 * - `6+` chars: the label is "copy" on hover and "copied" while copied.
 */
function getSegments(
  id: string,
  phase: DisplayPhase
): { label: string; faded: string } {
  if (phase === "idle" || id.length < 4) {
    return { label: "", faded: id };
  }
  const label = phase === "copied" && id.length >= 6 ? "copied" : "copy";
  return { label, faded: id.slice(label.length) };
}

interface CopyableIDBadgeProps {
  /**
   * The ID value to display in the badge and copy to the clipboard.
   */
  id: string;
  /**
   * The size of the badge.
   * @default 'S'
   */
  size?: ComponentSize;
  /**
   * Whether to display the id value alongside the icon. When `false`, only the
   * icon renders (an icon-only variant) but the full id is still copied on press
   * and surfaced via the badge's `title`. The badge keeps the same height as the
   * labeled variant.
   * @default true
   */
  showValue?: boolean;
}

/**
 * An ID badge, styled like {@link IDBadge}, that copies its ID when pressed.
 *
 * The leading ID icon becomes a copy icon on hover and a green checkmark once
 * copied. The visible value gains a left-aligned "copy"/"copied" label while the
 * remaining id characters fade out (see {@link fadeOpacityAt}), all without
 * shifting layout -- see {@link getSegments} for the length rules.
 *
 * Pass `showValue={false}` for an icon-only variant: the id is hidden but still
 * copied and surfaced via `title`, and the icon still cycles through the
 * id/copy/copied states. The height matches the labeled variant.
 */
export const CopyableIDBadge = ({
  id,
  size = "S",
  showValue = true,
}: CopyableIDBadgeProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const onPress = () => {
    copy(id);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, SHOW_COPIED_TIMEOUT_MS);
  };

  return (
    <span
      className="copyable-id-badge"
      title={id}
      css={copyableBadgeWrapperCSS}
    >
      <AriaButton
        css={copyableBadgeButtonCSS}
        aria-label={`Copy ID ${id}`}
        onPress={onPress}
      >
        {({ isHovered }) => {
          const phase: DisplayPhase = isCopied
            ? "copied"
            : isHovered
              ? "hover"
              : "idle";
          const { label, faded } = getSegments(id, phase);
          return (
            <Badge size={size}>
              <Icon
                // In the icon-only variant the icon occupies a value-height line
                // box so the badge stays the same height as the labeled variant.
                css={showValue ? undefined : copyableBadgeIconOnlyCSS}
                color={isCopied ? "success" : "inherit"}
                svgKey={
                  phase === "copied"
                    ? "Checkmark"
                    : phase === "hover"
                      ? "Duplicate"
                      : "ID"
                }
              />
              {showValue && (
                <Text fontFamily="mono" size="S" color="text-700">
                  {phase === "idle" ? (
                    faded
                  ) : label === "" ? (
                    // Too short to fit a label: nothing overwrites the id, but
                    // it still dims to the resting subdued opacity so the badge
                    // reads as "active" and matches the faded trailing chars of
                    // the longer variants.
                    <span style={{ opacity: FADE_END_OPACITY }}>{faded}</span>
                  ) : (
                    <>
                      {label}
                      {faded.split("").map((char, index) => (
                        <span
                          key={`${index}-${char}`}
                          style={{ opacity: fadeOpacityAt(index) }}
                        >
                          {char}
                        </span>
                      ))}
                    </>
                  )}
                </Text>
              )}
            </Badge>
          );
        }}
      </AriaButton>
    </span>
  );
};
