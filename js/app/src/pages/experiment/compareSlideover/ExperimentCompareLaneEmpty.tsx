import { css } from "@emotion/react";

import { Text } from "@phoenix/components";

const laneEmptyCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--global-dimension-size-800);
  padding: var(--global-dimension-size-200);
  border: var(--global-border-size-thin) dashed
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

/**
 * Fills a lane cell that has nothing to show, such as an example the
 * experiment did not run.
 */
export function ExperimentCompareLaneEmpty({ message }: { message: string }) {
  return (
    <div className="experiment-compare-lane-empty" css={laneEmptyCSS}>
      <Text color="text-500" size="S">
        {message}
      </Text>
    </div>
  );
}
