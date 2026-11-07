import type { HTMLAttributes, Ref } from "react";

import { classNames } from "@phoenix/utils/classNames";

import type { EdgeFadeEdge } from "./edgeFadeCSS";
import { edgeFadeCSS } from "./edgeFadeCSS";

export interface EdgeFadeProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  /**
   * The edge toward which the content fades to transparency.
   */
  edge: EdgeFadeEdge;
}

/**
 * Fades its content to transparency toward one edge, so a composition
 * appears to trail off beyond its frame, such as a stack of skeletons that
 * stands for content continuing past the visible area. The fade applies to
 * the group as a whole, not to each child. Size the band with
 * `--edge-fade-size`.
 */
export function EdgeFade({ ref, edge, className, ...props }: EdgeFadeProps) {
  return (
    <div
      ref={ref}
      className={classNames(className, "edge-fade")}
      css={edgeFadeCSS(edge)}
      {...props}
    />
  );
}

EdgeFade.displayName = "EdgeFade";
