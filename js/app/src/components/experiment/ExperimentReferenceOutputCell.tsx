import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { ExpandableContent, Flex, Text } from "@phoenix/components";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import { CellTop } from "@phoenix/components/table";
import { useExtractedOutputContent } from "@phoenix/hooks/useExtractedOutputContent";

const contentCSS = css`
  flex: none;
  padding: var(--global-dimension-size-200);
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
  /**
   * The caption above the content. Defaults to "reference output"; the
   * playground passes "output" when an evaluator task judges this value.
   */
  label?: string;
  /** Controls at the right of the cell's header strip */
  extra?: ReactNode;
}

/**
 * Cell component for rendering reference output with configurable height.
 *
 * If the output is a chat message format containing assistant messages,
 * it extracts the assistant content first. The result is rendered via
 * DynamicContent, so JSON (including JSON strings) is pretty-printed and
 * everything else is rendered as markdown.
 */
export function ExperimentReferenceOutputCell({
  value,
  height,
  label = "reference output",
  extra,
}: ExperimentReferenceOutputCellProps) {
  const content = useExtractedOutputContent(value);
  return (
    <Flex direction="column" height="100%">
      <CellTop extra={extra}>
        <Text color="text-500">{label}</Text>
      </CellTop>
      <ExpandableContent height={height}>
        <div css={contentCSS}>
          <DynamicContent value={content} />
        </div>
      </ExpandableContent>
    </Flex>
  );
}
