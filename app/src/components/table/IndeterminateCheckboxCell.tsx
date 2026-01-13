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
        padding: var(--ac-global-dimension-size-100);
      `}
    >
      <Checkbox inputRef={ref} isHovered={isHovered} {...checkboxProps} />
    </div>
  );
}
