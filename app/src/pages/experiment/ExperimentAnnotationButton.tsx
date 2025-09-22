import { ReactNode } from "react";
import { Pressable } from "react-aria-components";
import { css } from "@emotion/react";

import { Flex } from "@phoenix/components";
import {
  Annotation,
  AnnotationNameAndValue,
} from "@phoenix/components/annotation";
// TODO: add storybook story for this
/**
 * A button that appears like a list item but that is still interactive
 * to show a pop-over for the details
 */
export function ExperimentAnnotationButton({
  annotation,
  extra,
}: {
  annotation: Annotation;
  /**
   * Additional content like controls that will be placed on the right
   */
  extra?: ReactNode;
}) {
  return (
    <Pressable>
      <button
        className="button--reset"
        css={css`
          cursor: pointer;
          padding: var(--ac-global-dimension-size-50)
            var(--ac-global-dimension-size-100);
          flex: 1 1 auto;
          border-radius: var(--ac-global-rounding-small);
          width: 100%;
          &:hover {
            background-color: var(--ac-global-color-grey-200);
          }
        `}
      >
        <Flex
          direction="row"
          gap="size-100"
          alignItems="center"
          justifyContent="space-between"
        >
          <AnnotationNameAndValue
            annotation={annotation}
            displayPreference="score"
          />
          {extra}
        </Flex>
      </button>
    </Pressable>
  );
}
