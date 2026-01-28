import React from "react";
import { DraggableAttributes } from "@dnd-kit/core";
import { css } from "@emotion/react";

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
        background-color: var(--ac-global-input-field-background-color);
        border: 1px solid var(--ac-global-color-grey-400);
        color: var(--ac-global-text-color-900);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--ac-global-dimension-size-100)
          var(--ac-global-dimension-size-50);
        border-radius: var(--ac-global-rounding-small);
        overflow: hidden;
      `}
    >
      <svg viewBox="0 0 20 20" width="12" fill="currentColor">
        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
      </svg>
    </button>
  );
}

// Use Ref forwarding for DragHandle
const _DragHandle = React.forwardRef(DragHandle);
export { _DragHandle as DragHandle };
