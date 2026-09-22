import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { ExpandableContent, Flex, Text } from "@phoenix/components";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import { CellTop } from "@phoenix/components/table";

const contentCSS = css`
  flex: none;
  padding: var(--global-dimension-size-200);
`;

export interface ExperimentMetadataCellProps {
  /**
   * The example's metadata to render in the cell
   */
  value: unknown;
  /**
   * The height of the content area in pixels
   */
  height: number;
  /**
   * Controls shown at the right of the cell's header strip
   */
  extra?: ReactNode;
}

/**
 * Cell component for rendering a dataset example's metadata with configurable
 * height, beside the input and reference output cells.
 */
export function ExperimentMetadataCell({
  value,
  height,
  extra,
}: ExperimentMetadataCellProps) {
  return (
    <Flex direction="column" height="100%">
      <CellTop extra={extra}>
        <Text color="text-500">metadata</Text>
      </CellTop>
      <ExpandableContent height={height}>
        <div css={contentCSS}>
          <DynamicContent value={value} />
        </div>
      </ExpandableContent>
    </Flex>
  );
}
