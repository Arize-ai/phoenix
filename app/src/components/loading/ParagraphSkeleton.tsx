import { css } from "@emotion/react";

import { AnimationType, Skeleton } from "./Skeleton";

export interface ParagraphSkeletonProps {
  /**
   * Number of lines to display
   * @default 3
   */
  lines?: number;
  /**
   * The animation effect. If false, no animation is applied.
   * @default 'pulse'
   */
  animation?: AnimationType;
  /**
   * Gap between lines
   * @default 8
   */
  gap?: number;
}

const containerCSS = css`
  display: flex;
  flex-direction: column;
`;

const lineCSS = css`
  display: flex;
  gap: 6px;
`;

// Flex-grow patterns for each line to create natural word-width variation
const LINE_PATTERNS = [
  [3, 2, 5, 1.5, 4, 2.5, 4],
  [2, 4, 1.5, 5, 3, 3.5],
  [4, 2.5, 5, 2, 3],
  [3, 4.5, 2, 4, 1.5, 4],
  [3.5, 2, 5, 2.5],
];

// Line width percentages to vary line lengths
const LINE_WIDTHS = ["100%", "95%", "100%", "88%", "92%"];

/**
 * A skeleton that simulates multiple lines of text, like a paragraph.
 * Each line contains multiple word-like skeletons for a more realistic effect.
 */
export function ParagraphSkeleton({
  lines = 3,
  animation = "pulse",
  gap = 8,
}: ParagraphSkeletonProps) {
  const getWordsForLine = (lineIndex: number, isLastLine: boolean) => {
    const pattern = LINE_PATTERNS[lineIndex % LINE_PATTERNS.length];
    // Last line has fewer words
    const wordCount = isLastLine
      ? Math.ceil(pattern.length * 0.5)
      : pattern.length;
    return pattern.slice(0, wordCount);
  };

  return (
    <div
      css={[
        containerCSS,
        css`
          gap: ${gap}px;
        `,
      ]}
    >
      {Array.from({ length: lines }, (_, lineIndex) => {
        const isLastLine = lineIndex === lines - 1;
        const words = getWordsForLine(lineIndex, isLastLine);
        const lineWidth = isLastLine
          ? "55%"
          : LINE_WIDTHS[lineIndex % LINE_WIDTHS.length];

        return (
          <div
            key={lineIndex}
            css={[
              lineCSS,
              css`
                width: ${lineWidth};
              `,
            ]}
          >
            {words.map((flexGrow, wordIndex) => (
              <Skeleton
                key={wordIndex}
                css={css`
                  flex-grow: ${flexGrow};
                  min-width: 20px;
                `}
                height="1em"
                animation={animation}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
