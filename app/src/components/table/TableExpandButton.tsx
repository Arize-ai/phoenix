import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";

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
        color: var(--global-text-color-500);
        cursor: pointer;
        .icon-wrap {
          font-size: 1.2rem;
        }

        &:hover {
          color: var(--global-color-primary);
        }
      `}
    >
      <Icon
        svg={
          props.isExpanded ? (
            <Icons.ChevronDownOutline />
          ) : (
            <Icons.ChevronRightOutline />
          )
        }
      />
    </button>
  );
}
