import { css } from "@emotion/react";

import { DisclosureArrow } from "@phoenix/components/core/icon";

type TableExpandButtonProps = {
  onClick: (event: unknown) => void;
  ["aria-label"]: string;
  /**
   * The DOM id of the content the button reveals, so assistive technology can
   * follow the control to what it expanded.
   */
  ["aria-controls"]?: string;
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
      // The rotating chevron shows the state to sighted users; aria-expanded is
      // how everyone else reads it, so the label can stay constant
      aria-expanded={props.isExpanded}
      aria-controls={props["aria-controls"]}
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
