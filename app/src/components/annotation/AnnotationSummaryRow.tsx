import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Text } from "@phoenix/components";
import { AddAnnotationButton } from "@phoenix/components/annotation/AddAnnotationButton";

const annotationSummaryRowCSS = css`
  flex: none;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  height: 38px;
  padding: 0 var(--global-dimension-size-200) 0 var(--global-dimension-size-150);
  background-color: var(--global-color-gray-100);
  border-top: 1px solid var(--global-border-color-default);
  border-bottom: 1px solid var(--global-border-color-default);
`;

const annotationSummaryRowTitleCSS = css`
  flex: none;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  font-size: 10px;
`;

/**
 * A single-line, horizontally scrollable region. Content inside is forced
 * onto one line so the band keeps its fixed height.
 */
const annotationSummaryRowContentCSS = css`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  overflow-x: auto;
  /* the band has a fixed height — a visible scrollbar would consume it and
   * push the tokens off-center; the clipped last token signals overflow */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
  & > * {
    flex: none;
    flex-wrap: nowrap;
    width: max-content;
  }
`;

type AnnotationSummaryRowProps = {
  /**
   * The annotation tokens applied to the entity
   */
  children?: ReactNode;
  /**
   * When true, the band shows a "None yet" placeholder instead of tokens
   */
  isEmpty?: boolean;
  /**
   * Called when the user presses the add annotation button
   */
  onAddAnnotation?: () => void;
};

/**
 * A full-width band that presents the annotations applied to an entity
 * (e.g. a span) as a single row of inline tokens, with an affordance to add
 * an annotation at the trailing edge. Designed to sit between an entity
 * header and its tab bar.
 */
export function AnnotationSummaryRow({
  children,
  isEmpty = false,
  onAddAnnotation,
}: AnnotationSummaryRowProps) {
  return (
    <div css={annotationSummaryRowCSS} className="annotation-summary-row">
      <Text
        size="XS"
        color="text-500"
        weight="heavy"
        css={annotationSummaryRowTitleCSS}
      >
        Annotations
      </Text>
      <div
        css={annotationSummaryRowContentCSS}
        className="annotation-summary-row__content"
      >
        {isEmpty ? (
          <Text size="XS" color="text-500">
            None yet
          </Text>
        ) : (
          children
        )}
      </div>
      <AddAnnotationButton onPress={onAddAnnotation} bordered={isEmpty} />
    </div>
  );
}
