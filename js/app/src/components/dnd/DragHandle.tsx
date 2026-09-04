import { css } from "@emotion/react";
import type { Ref } from "react";

import { Icon, Icons } from "@phoenix/components";

/**
 * A grab handle for dnd-kit sortables. Pass the sortable's `handleRef` as
 * `ref`; give an `aria-label` naming what is being reordered.
 */
function DragHandle({
  ref,
  "aria-label": ariaLabel = "Drag to reorder",
}: {
  ref?: Ref<HTMLButtonElement>;
  "aria-label"?: string;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      className="button--reset drag-handle"
      css={css`
        cursor: grab;
        background-color: var(--global-input-field-background-color);
        border: 1px solid var(--global-color-gray-400);
        color: var(--global-text-color-900);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--global-rounding-small);
        overflow: hidden;
      `}
    >
      <Icon svg={<Icons.DragHandle />} />
    </button>
  );
}

export { DragHandle };
