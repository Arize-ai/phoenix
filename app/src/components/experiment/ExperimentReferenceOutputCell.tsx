import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import { MarkdownBlock } from "@phoenix/components/markdown";
import { CellTop, OverflowCell } from "@phoenix/components/table";
import { useExtractedOutputContent } from "@phoenix/hooks/useExtractedOutputContent";

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
 *
 * If the output is a chat message format containing assistant messages,
 * it extracts the assistant content and renders it as markdown.
 * Otherwise, it falls back to rendering as JSON or plain text via DynamicContent.
 */
export function ExperimentReferenceOutputCell({
  value,
  height,
}: ExperimentReferenceOutputCellProps) {
  const result = useExtractedOutputContent(value);
  return (
    <Flex direction="column" height="100%">
      <CellTop>
        <Text color="text-500">reference output</Text>
      </CellTop>
      <OverflowCell height={height}>
        <div css={contentCSS}>
          {result.isExtracted ? (
            <MarkdownBlock mode="markdown" margin="none">
              {result.content}
            </MarkdownBlock>
          ) : (
            <DynamicContent value={result.content} />
          )}
        </div>
      </OverflowCell>
    </Flex>
  );
}
