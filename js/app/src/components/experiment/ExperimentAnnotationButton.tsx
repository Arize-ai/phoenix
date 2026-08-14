import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Pressable } from "react-aria-components";

import { Flex } from "@phoenix/components";
import type { Annotation } from "@phoenix/components/annotation";
import { AnnotationNameAndValue } from "@phoenix/components/annotation";

/**
 * A button that appears like a list item but that is still interactive
 * to show a pop-over for the details
 */
export function ExperimentAnnotationButton({
  annotation,
  extra,
  positiveOptimization,
  compact = false,
}: {
  annotation: Annotation;
  /**
   * Whether the annotation is a positive or negative optimization
   *
   * If not provided, the component will not display the optimization information.
   */
  positiveOptimization?: boolean;
  /**
   * Additional content like controls that will be placed on the right
   */
  extra?: ReactNode;
  /**
   * Hug the annotation content instead of filling the container. Use in
   * shrink-to-fit slots (e.g. card headers) where the default's zeroed
   * intrinsic width would otherwise collapse the button or demand a fixed
   * width from the wrapper.
   */
  compact?: boolean;
}) {
  return (
    <Pressable>
      <button
        className="button--reset"
        data-compact={compact}
        css={css`
          /* Zero out the intrinsic inline size so a long nowrap annotation
             name can never widen an ancestor that sizes to content (e.g. the
             experiment compare table's auto-layout cells). Wrappers that
             shrink-wrap must give this button a definite width. */
          container-type: inline-size;
          cursor: pointer;
          padding: var(--global-dimension-size-50)
            var(--global-dimension-size-100);
          flex: 1 1 auto;
          border-radius: var(--global-rounding-small);
          width: 100%;
          min-width: 0;
          /* Match the metrics of a size-S Button so the chip reads as a peer
             control when they share a row. */
          &[data-compact="true"] {
            container-type: normal;
            flex: none;
            display: inline-flex;
            align-items: center;
            width: max-content;
            max-width: 100%;
            box-sizing: border-box;
            height: var(--global-button-height-s);
            padding: var(--global-dimension-size-50)
              var(--global-dimension-size-100);
          }
          &:hover {
            background-color: var(--global-color-gray-200);
          }
        `}
      >
        <Flex
          direction="row"
          gap={compact ? "size-100" : "size-600"}
          alignItems="center"
          justifyContent="space-between"
        >
          <AnnotationNameAndValue
            positiveOptimization={positiveOptimization}
            annotation={annotation}
            displayPreference="score-and-label"
            maxWidth="unset"
            minWidth={compact ? "unset" : undefined}
            showColorSwatch={false}
          />
          {extra}
        </Flex>
      </button>
    </Pressable>
  );
}
