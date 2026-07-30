import { css } from "@emotion/react";
import type { HTMLAttributes, ReactNode, SyntheticEvent } from "react";

import { classNames } from "@phoenix/utils/classNames";

const traceTreeRowControlsCSS = css`
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--global-dimension-size-50);
  padding-right: var(--global-dimension-size-100);

  .trace-tree-row-controls__disclosure {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--global-dimension-size-250);
    height: var(--global-dimension-size-250);
  }

  .trace-tree-row-controls__actions {
    display: flex;
    flex: none;
    align-items: center;
  }
`;

export type TraceTreeRowControlsProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  actions?: ReactNode;
  actionsClassName?: string;
  disclosure?: ReactNode;
  disclosureClassName?: string;
};

export function TraceTreeRowControls({
  actions,
  actionsClassName,
  className,
  disclosure,
  disclosureClassName,
  ...divProps
}: TraceTreeRowControlsProps) {
  const stopActionPropagation = (event: SyntheticEvent<HTMLSpanElement>) =>
    event.stopPropagation();

  return (
    <div
      {...divProps}
      className={classNames("trace-tree-row-controls", className)}
      css={traceTreeRowControlsCSS}
    >
      <span
        className={classNames(
          "trace-tree-row-controls__disclosure",
          disclosureClassName
        )}
      >
        {disclosure}
      </span>
      <span
        className={classNames(
          "trace-tree-row-controls__actions",
          actionsClassName
        )}
        onPointerDown={stopActionPropagation}
        onClick={stopActionPropagation}
      >
        {actions}
      </span>
    </div>
  );
}
