import { css } from "@emotion/react";

import { Flex, Icon, IconButton, Icons, Text } from "@phoenix/components";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import { CellTop, OverflowCell } from "@phoenix/components/table";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/tooltip";

const contentCSS = css`
  flex: none;
  padding: var(--ac-global-dimension-size-200);
`;

export interface ExperimentInputCellProps {
  /**
   * The example ID to display
   */
  exampleId: string;
  /**
   * The input value to render in the cell
   */
  value: unknown;
  /**
   * The height of the content area in pixels
   */
  height: number;
  /**
   * Callback when the expand button is clicked
   */
  onExpand: () => void;
}

/**
 * Cell component for rendering experiment input with an expand button.
 * Used in experiment compare tables and playground dataset tables.
 */
export function ExperimentInputCell({
  exampleId,
  value,
  height,
  onExpand,
}: ExperimentInputCellProps) {
  return (
    <Flex direction="column" height="100%">
      <CellTop
        extra={
          <TooltipTrigger>
            <IconButton
              size="S"
              aria-label="View example details"
              onPress={onExpand}
            >
              <Icon svg={<Icons.ExpandOutline />} />
            </IconButton>
            <Tooltip>
              <TooltipArrow />
              view example
            </Tooltip>
          </TooltipTrigger>
        }
      >
        <Text
          color="text-500"
          css={css`
            white-space: nowrap;
          `}
        >{`example ${exampleId}`}</Text>
      </CellTop>
      <OverflowCell height={height}>
        <div css={contentCSS}>
          <DynamicContent value={value} />
        </div>
      </OverflowCell>
    </Flex>
  );
}
