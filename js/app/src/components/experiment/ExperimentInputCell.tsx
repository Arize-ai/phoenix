import { css } from "@emotion/react";

import {
  ExpandableContent,
  Flex,
  Icon,
  IconButton,
  Icons,
  IDBadge,
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
   * The example ID
   */
  exampleId: string;
  /**
   * The example's external ID, displayed in place of the node ID when present
   */
  externalId?: string | null;
  /**
   * The input value to render in the cell
   */
  value: unknown;
  /**
   * The height of the content area in pixels
   */
  height: number;
  /**
   * Callback when the expand button is pressed
   */
  onExpand: () => void;
}

/**
 * Cell component for rendering experiment input with an expand button.
 * Used in experiment compare tables and playground dataset tables.
 */
export function ExperimentInputCell({
  exampleId,
  externalId,
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
              <Icon svg={<Icons.Expand />} />
            </IconButton>
            <Tooltip>
              <TooltipArrow />
              view example
            </Tooltip>
          </TooltipTrigger>
        }
      >
        <Flex direction="row" gap="size-100" alignItems="center">
          <Text color="text-500">example</Text>
          <IDBadge
            id={externalId ?? exampleId}
            variant="quiet"
            tooltipText="Copy example ID"
          />
        </Flex>
      </CellTop>
      <ExpandableContent height={height}>
        <div css={contentCSS}>
          <DynamicContent value={value} />
        </div>
      </ExpandableContent>
    </Flex>
  );
}
