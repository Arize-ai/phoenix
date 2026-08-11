import { css } from "@emotion/react";
import { useRef, useState } from "react";

import type { CheckboxProps } from "@phoenix/components/core/checkbox";
import { Checkbox } from "@phoenix/components/core/checkbox";

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
        user-select: none;
        // Fill the entire table cell so selecting a row does not require
        // pixel-precise aiming at the small checkbox. The negative margins
        // cancel the <td>'s own padding and the box then stretches to the full
        // cell via width/height 100%, making the whole cell a click target that
        // stops the click from bubbling to the row's navigation handler.
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: calc(100% + 2 * var(--global-table-cell-padding-x));
        height: calc(100% + 2 * var(--global-table-cell-padding-y));
        margin: calc(-1 * var(--global-table-cell-padding-y))
          calc(-1 * var(--global-table-cell-padding-x));
        padding: var(--global-table-cell-padding-y)
          var(--global-table-cell-padding-x);
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
