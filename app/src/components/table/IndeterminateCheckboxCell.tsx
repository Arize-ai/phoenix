import { HTMLProps, useEffect, useRef } from "react";
import { css } from "@emotion/react";

/**
 * A checkbox that can be in an indeterminate state.
 * Borrowed from tanstack/react-table example code.
 */
export function IndeterminateCheckboxCell({
  indeterminate,
  ...passThroughProps
}: { indeterminate?: boolean } & HTMLProps<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null!);

  useEffect(() => {
    if (typeof indeterminate === "boolean") {
      ref.current.indeterminate = !passThroughProps.checked && indeterminate;
    }
  }, [ref, indeterminate, passThroughProps.checked]);

  return (
    <div
      onClick={(e) => {
        // prevent conflicts with the table row click event
        e.stopPropagation();
      }}
    >
      <input
        type="checkbox"
        ref={ref}
        css={css`
          cursor: pointer;
        `}
        {...passThroughProps}
      />
    </div>
  );
}
