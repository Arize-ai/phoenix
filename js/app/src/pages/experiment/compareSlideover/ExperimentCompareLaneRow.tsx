import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { classNames } from "@phoenix/utils/classNames";

import type { CompareLane } from "./experimentCompareLaneTypes";

/**
 * The slideover's width below which lanes stack instead of sitting side by
 * side. It is a container width, since the slideover is resizable.
 */
const STACKED_LANES_MAX_WIDTH_PX = 900;

export const EXPERIMENT_COMPARE_SLIDEOVER_CONTAINER_NAME =
  "experiment-compare-slideover";

/** The container query under which lanes stack */
export const STACKED_LANES_CONTAINER_QUERY = `@container ${EXPERIMENT_COMPARE_SLIDEOVER_CONTAINER_NAME} (max-width: ${STACKED_LANES_MAX_WIDTH_PX}px)`;

const laneRowCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr);

  &[data-lane-count="2"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .experiment-compare-lane-row__cell {
    min-width: 0;
    box-sizing: border-box;
  }
  &[data-divided="true"]
    .experiment-compare-lane-row__cell
    + .experiment-compare-lane-row__cell {
    border-left: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }

  ${STACKED_LANES_CONTAINER_QUERY} {
    &[data-lane-count="2"] {
      grid-template-columns: minmax(0, 1fr);
    }
    &[data-divided="true"]
      .experiment-compare-lane-row__cell
      + .experiment-compare-lane-row__cell {
      border-left: none;
      border-top: var(--global-border-size-thin) solid
        var(--global-border-color-default);
    }
  }
`;

/**
 * One row of the slideover split into a cell per lane, so the same content
 * lines up across the base and compare experiments. The cells stack when the
 * slideover is narrow. Each cell is tagged with its lane's side, which is how
 * the slideover tells which lane the user is working in.
 */
export function ExperimentCompareLaneRow({
  lanes,
  children,
  className,
  isDividerHidden = false,
}: {
  /** The base lane, then the compare lane when there is one */
  lanes: readonly CompareLane[];
  children: (lane: CompareLane) => ReactNode;
  className?: string;
  /** Leaves out the rule between the lanes, for rows whose cells hold cards */
  isDividerHidden?: boolean;
}) {
  return (
    <div
      className={classNames("experiment-compare-lane-row", className)}
      css={laneRowCSS}
      data-lane-count={lanes.length}
      data-divided={!isDividerHidden}
    >
      {lanes.map((lane) => (
        <div
          key={lane.side}
          className="experiment-compare-lane-row__cell"
          data-lane={lane.side}
        >
          {children(lane)}
        </div>
      ))}
    </div>
  );
}
