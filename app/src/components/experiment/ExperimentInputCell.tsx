import { css } from "@emotion/react";

import { Flex, Icon, IconButton, Icons, Text } from "@phoenix/components";
import { CopyButton } from "@phoenix/components/core/copy";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/core/tooltip";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import { CellTop, OverflowCell } from "@phoenix/components/table";

const contentCSS = css`
  flex: none;
  padding: var(--global-dimension-size-200);
`;

const cellTopWrapCSS = css`
  .input-cell__copy {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease-in-out;
  }

  &:hover .input-cell__copy {
    opacity: 1;
    pointer-events: auto;
  }
`;

const idTextCSS = css`
  font-family: "Geist Mono", monospace;
  font-size: var(--global-font-size-s);
  white-space: nowrap;
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
      <div css={cellTopWrapCSS}>
        <CellTop
          extra={
            <>
              <div className="input-cell__copy">
                <CopyButton text={exampleId} variant="quiet" />
              </div>
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
            </>
          }
        >
          <Text color="text-500">
            <span css={idTextCSS}>{exampleId.slice(0, 8)}…</span>
          </Text>
        </CellTop>
      </div>
      <OverflowCell height={height}>
        <div css={contentCSS}>
          <DynamicContent value={value} />
        </div>
      </OverflowCell>
    </Flex>
  );
}
