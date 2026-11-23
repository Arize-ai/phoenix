import { css } from "@emotion/react";

import { Skeleton } from "./Skeleton";

export interface ParagraphSkeletonProps {
  /**
   * Number of lines to display
   * @default 3
   */
  lines?: number;
}

const containerCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  width: 100%;
`;

const LINE_WIDTHS = ["100%", "95%", "100%", "88%", "92%"];

/**
 * A skeleton that simulates multiple lines of text, like a paragraph.
 * Each line is one bar, and the lines vary in length.
 */
export function ParagraphSkeleton({ lines = 3 }: ParagraphSkeletonProps) {
  return (
    <div css={containerCSS}>
      {Array.from({ length: lines }, (_, lineIndex) => (
        <Skeleton
          key={lineIndex}
          width={
            lineIndex === lines - 1
              ? "55%"
              : LINE_WIDTHS[lineIndex % LINE_WIDTHS.length]
          }
          height="1em"
        />
      ))}
    </div>
  );
}
