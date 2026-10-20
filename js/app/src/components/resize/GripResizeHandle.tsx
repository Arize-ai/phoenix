import { css } from "@emotion/react";
import type { SeparatorProps } from "react-resizable-panels";
import { Separator } from "react-resizable-panels";

/**
 * Pixels the pointer can be from a separator and still grab it: generous for
 * a mouse, which a 1px line otherwise leaves almost nothing to aim at, and
 * more again for touch. Pass to the `Group` as `resizeTargetMinimumSize`.
 */
export const GRIP_RESIZE_TARGET_MINIMUM_SIZE = { fine: 16, coarse: 28 };

/**
 * A separator that reads as something to drag: a line a step stronger than
 * the borders around it, with a grip at its middle. Over its hit area, while
 * dragged, and when focused from the keyboard, the line and the grip take the
 * accent color. Use where resizing is part of the workflow and a bare 1px
 * line would pass for one more border; where a divider should stay quiet,
 * use `compactResizeHandleCSS` instead.
 */
export function GripResizeHandle(props: Omit<SeparatorProps, "children">) {
  return (
    <Separator {...props} css={gripResizeHandleCSS}>
      <span className="grip-resize-handle__grip" aria-hidden />
    </Separator>
  );
}

const gripResizeHandleCSS = css`
  position: relative;
  outline: none;
  background-color: var(--global-resize-handle-line-color);
  transition: background-color 150ms ease-in-out;
  &[aria-orientation="vertical"] {
    width: 1px;
  }
  &[aria-orientation="horizontal"] {
    height: 1px;
  }
  .grip-resize-handle__grip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: var(--global-rounding-full);
    background-color: var(--global-resize-handle-grip-color);
    transition: background-color 150ms ease-in-out;
    // Above the panels on either side, which it overhangs.
    z-index: 1;
    pointer-events: none;
  }
  &[aria-orientation="vertical"] .grip-resize-handle__grip {
    width: 4px;
    height: 32px;
  }
  &[aria-orientation="horizontal"] .grip-resize-handle__grip {
    width: 32px;
    height: 4px;
  }
  &[data-separator="hover"],
  &[data-separator="active"],
  &[data-separator="focus"] {
    background-color: var(--global-resize-handle-active-color);
    .grip-resize-handle__grip {
      background-color: var(--global-resize-handle-active-color);
    }
  }
`;
