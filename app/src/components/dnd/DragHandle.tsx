import type { DraggableAttributes } from "@dnd-kit/core";
import { css } from "@emotion/react";
import React from "react";

import { Icon, Icons } from "@phoenix/components";

// This is the type of the listeners object from useSortable
// However it is not exported from @dnd-kit/core so we have to redefine it here
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type Listeners = Record<string, Function>;

function DragHandle(
  {
    listeners,
    attributes,
  }: {
    listeners?: Listeners;
    attributes: DraggableAttributes;
  },
  ref: React.Ref<HTMLButtonElement>
) {
  return (
    <button
      ref={ref}
      {...listeners}
      {...attributes}
      aria-roledescription="draggable"
      aria-pressed="false"
      aria-disabled="false"
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
      <Icon svg={<Icons.DragHandleOutline />} />
    </button>
  );
}

// Use Ref forwarding for DragHandle
const _DragHandle = React.forwardRef(DragHandle);
export { _DragHandle as DragHandle };
