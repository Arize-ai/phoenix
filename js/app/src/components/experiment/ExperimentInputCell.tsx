import { css } from "@emotion/react";

import {
  ExpandableContent,
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
} from "@phoenix/components";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/core/tooltip";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import { CellTop } from "@phoenix/components/table";

const contentCSS = css`
  flex: none;
  padding: var(--global-dimension-size-200);
`;

export interface ExperimentInputCellProps {
  /**
   * The example node ID (used as the default display label)
   */
  exampleId: string;
  /**
   * Optional human-facing ID (e.g. dataset externalId). Falls back to exampleId.
   */
  exampleDisplayId?: string | null;
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
  exampleDisplayId,
  value,
  height,
  onExpand,
}: ExperimentInputCellProps) {
  const displayId = exampleDisplayId || exampleId;
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
              <Icon svg={<Icons.Expand />} />
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
        >{`example ${displayId}`}</Text>
      </CellTop>
      <ExpandableContent height={height}>
        <div css={contentCSS}>
          <DynamicContent value={value} />
        </div>
      </ExpandableContent>
    </Flex>
  );
}
