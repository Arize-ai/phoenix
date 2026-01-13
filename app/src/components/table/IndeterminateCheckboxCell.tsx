import { useRef, useState } from "react";
import { css } from "@emotion/react";

import { Checkbox, CheckboxProps } from "@phoenix/components/checkbox";
/**
 * A checkbox that can be in an indeterminate state.
 * Borrowed from tanstack/react-table example code.
 */
export function IndeterminateCheckboxCell(checkboxProps: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null!);
  const [isHovered, setIsHovered] = useState(false);

  const { isSelected, onChange } = checkboxProps;

  return (
    <div
      onClick={(e) => {
        // prevent conflicts with the table row click event
        e.stopPropagation();
        onChange?.(!isSelected);
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
