import { css } from "@emotion/react";

import { DisclosureArrow } from "@phoenix/components";

type TableExpandButtonProps = {
  onClick: (event: unknown) => void;
  ["aria-label"]: string;
  isExpanded: boolean;
};
export function TableExpandButton(props: TableExpandButtonProps) {
  return (
    <button
      className="button--reset"
      onClick={(e) => {
        // Stop the propagation to prevent the row from sorting
        e.stopPropagation();
        props.onClick(e);
      }}
      aria-label={props["aria-label"]}
      css={css`
        cursor: pointer;
        display: flex;
        align-items: center;
        .icon-wrap {
          font-size: 1rem;
        }

        &:hover .disclosure-arrow {
          color: var(--global-color-primary);
        }
      `}
    >
      <DisclosureArrow isExpanded={props.isExpanded} />
    </button>
  );
}
