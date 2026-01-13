import { useRef, useState } from "react";
import { css } from "@emotion/react";

import { Checkbox, CheckboxProps } from "@phoenix/components/checkbox";

type IndeterminateCheckboxCellProps = CheckboxProps & {
  /**
   * Optional click handler for the cell. When provided, this is called instead
   * of the default onChange toggle behavior. Useful for implementing custom
   * selection logic like shift-click range selection.
   */
  onCellClick?: (event: React.MouseEvent) => void;
};

/**
 * A checkbox that can be in an indeterminate state.
 * Borrowed from tanstack/react-table example code.
 */
export function IndeterminateCheckboxCell({
  onCellClick,
  ...checkboxProps
}: IndeterminateCheckboxCellProps) {
  const ref = useRef<HTMLInputElement>(null!);
  const [isHovered, setIsHovered] = useState(false);

  const { isSelected, onChange } = checkboxProps;

  return (
    <div
      onClick={(e) => {
        // prevent conflicts with the table row click event
        e.stopPropagation();
        // prevent browser's default shift-click text selection behavior
        e.preventDefault();
        if (onCellClick) {
          onCellClick(e);
        } else {
          onChange?.(!isSelected);
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      css={css`
        cursor: pointer;
        padding: var(--ac-global-dimension-size-25);
        user-select: none;
      `}
    >
      <Checkbox
        inputRef={ref}
        isHovered={isHovered}
        {...checkboxProps}
        css={
          onCellClick
            ? css`
                /* When onCellClick is provided, disable pointer events on the
                 * checkbox so clicks pass through to the wrapper div's onClick.
                 * This ensures the custom click handler is always triggered,
                 * even when clicking directly on the checkbox input element. */
                pointer-events: none;
              `
            : undefined
        }
      />
    </div>
  );
}
