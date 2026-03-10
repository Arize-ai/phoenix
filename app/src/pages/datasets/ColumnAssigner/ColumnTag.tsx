import { css } from "@emotion/react";
import { useRef } from "react";
import { useDrag } from "react-aria";

import { Icon, Icons } from "@phoenix/components";

const tagCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-50);
  min-width: 0; /* Allow flex child to shrink below content size */
  padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
  border: 1px solid var(--global-color-gray-400);
  border-radius: var(--global-rounding-medium);
  background-color: var(--global-input-field-background-color);
  cursor: grab;
  flex-shrink: 0; /* Don't shrink chips themselves */

  &[data-dragging="true"] {
    opacity: 0.5;
  }

  &[data-assigned="true"] {
    border-color: var(--global-color-primary);
    background-color: var(--global-color-primary-100);
  }
`;

const handleCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--global-text-color-700);
`;

const labelCSS = css`
  flex: 1;
  min-width: 0; /* Allow text to shrink and truncate */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--global-font-size-s);
  color: var(--global-text-color-900);
`;

export type ColumnTagProps = {
  column: string;
  /** Tab index for keyboard navigation (roving tabindex pattern) */
  tabIndex?: number;
  /** Callback when tag receives focus */
  onFocus?: () => void;
  /** Whether this tag is in an assignment bucket (shows highlighted style) */
  isAssigned?: boolean;
};

export function ColumnTag({
  column,
  tabIndex = 0,
  onFocus,
  isAssigned = false,
}: ColumnTagProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { dragProps, isDragging } = useDrag({
    getItems() {
      return [{ "text/plain": column }];
    },
  });

  const handleFocus = () => {
    onFocus?.();
  };

  return (
    <div
      ref={ref}
      {...dragProps}
      css={tagCSS}
      data-tag
      data-dragging={isDragging}
      data-assigned={isAssigned}
      onFocus={handleFocus}
      role="option"
      tabIndex={tabIndex}
      title={column}
    >
      <span css={handleCSS}>
        <Icon svg={<Icons.DragHandleOutline />} />
      </span>
      <span css={labelCSS}>{column}</span>
    </div>
  );
}
