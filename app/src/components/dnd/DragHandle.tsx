import { css } from "@emotion/react";
import type { Ref } from "react";

import { Icon, Icons } from "@phoenix/components";

function DragHandle({ ref }: { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      aria-label="Reorder message"
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
