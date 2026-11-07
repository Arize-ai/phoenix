import type { ReactElement } from "react";
import { Focusable } from "react-aria";

import { TooltipTrigger } from "@phoenix/components";

/** The tooltip's offset from its anchor, plus room for its arrow. */
const TOOLTIP_OFFSET = 48;

export type HeldOpenTooltipProps = {
  /** The tooltip, as it would be the second child of a `TooltipTrigger`. */
  children: ReactElement;
  /** The side the tooltip opens toward, from its placement. */
  opens: "left" | "right";
  /** The tooltip's width. */
  width: number;
  /** The room to reserve for the open tooltip, which takes no layout space. */
  height: number;
};

/**
 * A frame that holds one tooltip open for a story, against an empty,
 * zero-width anchor at the side of the frame opposite where the tooltip
 * opens.
 *
 * React Aria positions a tooltip against the viewport and takes no other
 * boundary, so a story of held-open tooltips renders in a Docs frame of its
 * own (`parameters.docs.story = { inline: false, height }`) tall enough for
 * every frame in it.
 */
export function HeldOpenTooltip({
  children,
  opens,
  width,
  height,
}: HeldOpenTooltipProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: opens === "right" ? "flex-start" : "flex-end",
        width: width + TOOLTIP_OFFSET,
        height,
      }}
    >
      <TooltipTrigger isOpen>
        <Focusable>
          <span tabIndex={-1} style={{ display: "block", height: 32 }} />
        </Focusable>
        {children}
      </TooltipTrigger>
    </div>
  );
}
