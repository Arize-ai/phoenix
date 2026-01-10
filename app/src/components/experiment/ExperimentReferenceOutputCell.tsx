import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import { CellTop, OverflowCell } from "@phoenix/components/table";
import { useUnnestedValue } from "@phoenix/hooks/useUnnestedValue";

const contentCSS = css`
  flex: none;
  padding: var(--ac-global-dimension-size-200);
`;

export interface ExperimentReferenceOutputCellProps {
  /**
   * The value to render in the cell
   */
  value: unknown;
  /**
   * The height of the content area in pixels
   */
  height: number;
}

/**
 * Cell component for rendering reference output with configurable height.
 * Automatically unnests single-key JSON objects (e.g., {"response": "Hello"} becomes "Hello").
 */
export function ExperimentReferenceOutputCell({
  value,
  height,
}: ExperimentReferenceOutputCellProps) {
  const { value: unnestedValue } = useUnnestedValue(value);
  return (
    <Flex direction="column" height="100%">
      <CellTop>
        <Text color="text-500">reference output</Text>
      </CellTop>
      <OverflowCell height={height}>
        <div css={contentCSS}>
          <DynamicContent value={unnestedValue} />
        </div>
      </OverflowCell>
    </Flex>
  );
}
