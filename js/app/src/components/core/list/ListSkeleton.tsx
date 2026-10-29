import { css } from "@emotion/react";
import type { HTMLAttributes, Ref, RefObject } from "react";
import { useLayoutEffect, useState } from "react";
import { useObjectRef } from "react-aria";

import type { EdgeFadeEdge } from "@phoenix/components/core/layout";
import { edgeFadeCSS } from "@phoenix/components/core/layout";
import { Skeleton } from "@phoenix/components/core/loading";
import type { ComponentSize } from "@phoenix/components/core/types";
import { classNames } from "@phoenix/utils/classNames";

const ITEM_HEIGHTS: Record<ComponentSize, string> = {
  S: "var(--global-dimension-size-450)",
  M: "var(--global-dimension-size-800)",
  L: "var(--global-dimension-size-1200)",
};

const listSkeletonCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);
  &[data-fill="true"] {
    flex: 1 1 auto;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  &[data-fade-edge="bottom"] {
    ${edgeFadeCSS("bottom")}
  }
  /* A counted list taller than its container would be clipped mid-fade;
     capped, the fade band shrinks with it and still ends at the edge. */
  &[data-fade-edge][data-fill="false"] {
    max-height: 100%;
    overflow: hidden;
  }
  .list-skeleton__item {
    flex: none;
  }
`;

export interface ListSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  /**
   * The number of placeholder items, or `"fill"` to fill the height of the
   * container with as many items as fit. Fill when the loaded list fills its
   * container; the container must then have a definite height, or be a flex
   * column whose remaining height the skeleton takes.
   * @default 5
   */
  itemCount?: number | "fill";
  /**
   * The height of each item. Choose the size closest to the loaded items'
   * height.
   * @default 'M'
   */
  size?: ComponentSize;
  /**
   * The edge toward which the items fade to transparency, so the list appears
   * to continue beyond it, or `null` for no fade. A filling list runs on past
   * its container, so it fades toward the bottom unless told otherwise. A
   * counted list that fades is capped at its container's height, so the fade
   * still ends at the edge when the container is shorter than the list.
   * @default 'bottom' when `itemCount` is `"fill"`, otherwise `null`
   */
  fadeEdge?: EdgeFadeEdge | null;
}

/**
 * A loading placeholder for a list: a column of item-height blocks separated
 * by a fixed gap. It marks where the loaded items will be rather than what
 * they will hold, and draws nothing but skeletons.
 */
export function ListSkeleton({
  ref,
  itemCount = 5,
  size = "M",
  fadeEdge,
  className,
  ...props
}: ListSkeletonProps) {
  const isFill = itemCount === "fill";
  const resolvedFadeEdge =
    fadeEdge === undefined && isFill ? "bottom" : fadeEdge;
  const listRef = useObjectRef(ref);
  const fillItemCount = useFillItemCount(listRef, isFill);
  const renderedItemCount = isFill ? fillItemCount : itemCount;
  return (
    <div
      role="status"
      aria-label="loading"
      ref={listRef}
      className={classNames(className, "list-skeleton")}
      css={listSkeletonCSS}
      data-fill={isFill}
      data-fade-edge={resolvedFadeEdge ?? undefined}
      {...props}
    >
      {Array.from({ length: renderedItemCount }, (_, index) => (
        <Skeleton
          key={index}
          className="list-skeleton__item"
          height={ITEM_HEIGHTS[size]}
          aria-hidden
        />
      ))}
    </div>
  );
}

ListSkeleton.displayName = "ListSkeleton";

/**
 * The number of items that fill the list's height, counting a last item that
 * is only partly visible. It renders one item first to measure the item
 * height, and measures in a layout effect so the filled items appear on the
 * first paint.
 */
function useFillItemCount(
  listRef: RefObject<HTMLDivElement | null>,
  isFill: boolean
) {
  const [itemCount, setItemCount] = useState(1);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!isFill || !list) return undefined;
    const update = () => {
      const itemHeight = list.firstElementChild?.getBoundingClientRect().height;
      if (!itemHeight) return;
      const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
      setItemCount(
        Math.max(1, Math.ceil((list.clientHeight + gap) / (itemHeight + gap)))
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, isFill]);
  return itemCount;
}
