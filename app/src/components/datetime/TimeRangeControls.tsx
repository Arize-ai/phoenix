import { css, keyframes } from "@emotion/react";
import type { ReactNode } from "react";

import { Button } from "../core/button";
import { Icon, Icons } from "../core/icon";
import { ToggleButton } from "../core/toggleButtonGroup";
import { Tooltip, TooltipTrigger } from "../core/tooltip";
import type { ComponentSize } from "../core/types";
import type { OpenTimeRangeWithKey } from "./types";
import {
  panTimeRangeLeft,
  panTimeRangeRight,
  zoomTimeRangeIn,
  zoomTimeRangeOut,
} from "./utils";

export type TimeRangeControlsProps = {
  /** The currently committed range, including its preset key. */
  value: OpenTimeRangeWithKey;
  /** Called when a pan or zoom commits a new range. */
  onChange: (value: OpenTimeRangeWithKey) => void;
  /** Whether the view is live (streaming in new data). */
  isLive?: boolean;
  /**
   * Called when the user presses the live play/stop toggle. When omitted, the
   * toggle is not rendered and the strip is a pure pan/zoom control.
   */
  onIsLiveChange?: (isLive: boolean) => void;
  /** Disables every control. */
  isDisabled?: boolean;
  /** Visual size for the buttons. */
  size?: Exclude<ComponentSize, "L">;
};

const livePulseKeyframes = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
`;

/**
 * A single input-styled shell so the strip reads as one control and shares
 * the height, border, and background of the time range selector beside it.
 */
const timeRangeControlsCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-50);
  width: fit-content;
  box-sizing: border-box;
  /* Uniform inset so each button's hover pill floats evenly in the shell. */
  padding: var(--global-dimension-size-50);
  background-color: var(--global-input-field-background-color);
  border: var(--global-border-size-thin) solid
    var(--global-input-field-border-color);
  border-radius: var(--global-rounding-small);

  &[data-size="S"] {
    height: var(--global-input-height-s);
  }
  &[data-size="M"] {
    height: var(--global-input-height-m);
  }

  /* Fade the whole shell as one unit, not each button twice over. */
  &[data-disabled] {
    opacity: var(--global-opacity-disabled);
    button[disabled] {
      opacity: 1;
    }
  }
`;

/**
 * Buttons sit inset within the shell as borderless squares whose rounding is
 * concentric with the shell's. Geometry overrides are scoped to the same
 * data-attributes the base button styles use so they win the cascade.
 */
const controlButtonCSS = css`
  position: relative;
  border: none;
  background-color: transparent;
  border-radius: var(--global-rounding-xsmall);
  color: var(--global-text-color-700);
  transition:
    background-color 0.2s ease-in-out,
    color 0.2s ease-in-out;

  &[data-size] {
    align-self: stretch;
    height: auto;
    aspect-ratio: 1 / 1;
  }
  &[data-size][data-childless] {
    padding: 0;
  }

  /* One optical size for glyphs from both icon families. */
  .icon-wrap {
    font-size: var(--global-font-size-s);
  }

  /* Solid play/pause glyphs give the center control a media-transport feel
     and anchor it against the stroked pan/zoom icons around it. */
  &.time-range-controls__live-toggle .icon-wrap svg :is(path, rect) {
    fill: currentColor;
  }

  &:hover:not([disabled]),
  &[data-hovered]:not([data-disabled]):not([data-selected="true"]) {
    background-color: var(--global-input-field-background-color-active);
    color: var(--global-text-color-900);
  }

  /* Streaming live uses a gently pulsing neutral tint so the center control
     doesn't compete with status colors elsewhere. The tint lives on an
     overlay so the pulse composes from the static token instead of
     animating between raw colors. */
  &[data-selected="true"] {
    isolation: isolate;
    background-color: transparent;
    color: var(--global-text-color-900);
    &:hover:not([data-disabled]) {
      background-color: var(--global-input-field-background-color-active);
    }
    &::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      border-radius: inherit;
      background-color: var(--global-input-field-background-color-active);
      animation: ${livePulseKeyframes} 3s ease-in-out infinite;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-selected="true"]::before {
      animation: none;
    }
  }
`;

/** A quiet icon button in the shell whose tooltip doubles as its label. */
function ControlButton(props: {
  label: string;
  icon: ReactNode;
  size: TimeRangeControlsProps["size"];
  isDisabled?: boolean;
  onPress: () => void;
}) {
  const { label, icon, size, isDisabled, onPress } = props;
  return (
    <TooltipTrigger>
      <Button
        size={size}
        variant="quiet"
        css={controlButtonCSS}
        aria-label={label}
        isDisabled={isDisabled}
        leadingVisual={<Icon svg={icon} />}
        onPress={onPress}
      />
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}

/**
 * A compact toolbar of icon buttons for steering the active time range,
 * designed to sit beside the time range selector and share its chrome.
 * Minus/plus zoom the window wider or narrower (live ranges stay live,
 * anchored to now), and the chevrons pan the window back or forward by half
 * its width. Panning forward is capped at the present and unavailable while
 * the range is open-ended (already at the live edge). When live-streaming
 * props are provided a play/stop toggle sits in the center, carrying a gently
 * pulsing active tint while live.
 */
export function TimeRangeControls(props: TimeRangeControlsProps) {
  const {
    value,
    onChange,
    isLive = false,
    onIsLiveChange,
    isDisabled,
    size = "S",
  } = props;
  // Without a start there is no window to pan or zoom by.
  const hasWindow = value.start != null;
  const liveToggleLabel = isLive
    ? "Stop live streaming"
    : "Resume live streaming";
  // An open-ended range is already at the live edge.
  const isAtLiveEdge = value.end == null;

  const applyChange = (next: OpenTimeRangeWithKey | null) => {
    if (next) {
      onChange(next);
    }
  };

  return (
    <div
      className="time-range-controls"
      css={timeRangeControlsCSS}
      role="group"
      aria-label="Time range controls"
      data-size={size}
      data-disabled={isDisabled || undefined}
    >
      <ControlButton
        label="Pan back in time"
        icon={<Icons.ChevronLeftSmall />}
        size={size}
        isDisabled={isDisabled || !hasWindow}
        onPress={() => applyChange(panTimeRangeLeft({ value }))}
      />
      <ControlButton
        label="Zoom out"
        icon={<Icons.Minus />}
        size={size}
        isDisabled={isDisabled || !hasWindow}
        onPress={() => applyChange(zoomTimeRangeOut({ value }))}
      />
      {onIsLiveChange && (
        <TooltipTrigger>
          <ToggleButton
            size={size}
            className="time-range-controls__live-toggle"
            css={controlButtonCSS}
            aria-label={liveToggleLabel}
            isSelected={isLive}
            isDisabled={isDisabled}
            leadingVisual={
              <Icon svg={isLive ? <Icons.Pause /> : <Icons.Play />} />
            }
            onChange={onIsLiveChange}
          />
          <Tooltip>{liveToggleLabel}</Tooltip>
        </TooltipTrigger>
      )}
      <ControlButton
        label="Zoom in"
        icon={<Icons.Plus />}
        size={size}
        isDisabled={isDisabled || !hasWindow}
        onPress={() => applyChange(zoomTimeRangeIn({ value }))}
      />
      <ControlButton
        label="Pan forward in time"
        icon={<Icons.ChevronRightSmall />}
        size={size}
        isDisabled={isDisabled || !hasWindow || isAtLiveEdge}
        onPress={() => applyChange(panTimeRangeRight({ value }))}
      />
    </div>
  );
}
