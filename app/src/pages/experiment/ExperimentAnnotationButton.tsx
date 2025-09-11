import { Pressable } from "react-aria-components";
import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import {
  Annotation,
  AnnotationNameAndValue,
} from "@phoenix/components/annotation";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";
/**
 * A button that appears like a list item but that is still interactive
 * to show a pop-over for the details
 */
export function ExperimentAnnotationButton({
  annotation,
  meanAnnotationScore,
  numRepetitions,
}: {
  annotation: Annotation;
  meanAnnotationScore?: number | null | undefined;
  numRepetitions?: number | null | undefined;
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
          {meanAnnotationScore != null &&
          numRepetitions != null &&
          numRepetitions > 1 ? (
            <Flex direction="row" gap="size-100" alignItems="center">
              <Text fontFamily="mono">
                {floatFormatter(meanAnnotationScore)}
              </Text>
              <Text fontFamily="mono" color="grey-500">
                AVG
              </Text>
            </Flex>
          ) : null}
        </Flex>
      </button>
    </Pressable>
  );
}
