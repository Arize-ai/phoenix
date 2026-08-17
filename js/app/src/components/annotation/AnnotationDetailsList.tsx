import { css } from "@emotion/react";
import { type ReactNode, useId } from "react";

import { Flex, Text, View } from "@phoenix/components";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import { MeanScore } from "@phoenix/components/annotation/MeanScore";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { AnnotatorKindToken } from "@phoenix/components/trace/AnnotatorKindToken";
import { UserDisplay } from "@phoenix/components/user/UserDisplay";
import { isAnnotatorKind } from "@phoenix/constants";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import { hasAnnotationValue } from "./annotationUtils";
import {
  getPositiveOptimizationFromConfig,
  type AnnotationOptimizationConfig,
} from "./optimizationUtils";
import type { Annotation } from "./types";

const annotationListCSS = css`
  list-style: none;
  margin: 0;
  max-height: 400px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0;

  > li {
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
  }

  > li + li {
    border-top: 1px solid var(--global-border-color-default);
  }
`;

const annotationAuthorCSS = css`
  overflow: hidden;
`;

const annotationValueCSS = css`
  min-width: 0;
  flex: 1 1 auto;
`;

export function AnnotationDetailsList({
  annotations,
  annotationConfig,
  meanScore,
  renderFilterActions,
}: {
  annotations: readonly Annotation[];
  annotationConfig?: AnnotationOptimizationConfig;
  meanScore?: number | null;
  renderFilterActions?: (annotation: Annotation) => ReactNode;
}) {
  const annotationName = annotations[0]?.name;
  const headingId = useId();
  if (annotationName == null) {
    return null;
  }
  const meanPositiveOptimization = getPositiveOptimizationFromConfig({
    config: annotationConfig,
    score: meanScore,
  });

  return (
    <section aria-labelledby={headingId}>
      <View
        elementType="header"
        minWidth={0}
        paddingX="size-200"
        paddingY="size-100"
        borderBottomWidth="thin"
        borderBottomColor="default"
      >
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap="size-100"
        >
          <View minWidth={0} flex="1 1 auto">
            <Truncate maxWidth="100%" title={annotationName}>
              <Text
                id={headingId}
                weight="heavy"
                color="inherit"
                size="S"
                elementType="h3"
              >
                {annotationName}
              </Text>
            </Truncate>
          </View>
          {meanScore != null ? (
            <View flex="none">
              <MeanScore
                value={meanScore}
                size="S"
                positiveOptimization={meanPositiveOptimization}
              />
            </View>
          ) : null}
        </Flex>
      </View>
      <ul css={annotationListCSS} aria-labelledby={headingId} role="list">
        {annotations.map((annotation, index) => (
          <AnnotationDetailsListItem
            key={annotation.id ?? `${annotation.createdAt}-${index}`}
            annotation={annotation}
            annotationConfig={annotationConfig}
            renderFilterActions={renderFilterActions}
          />
        ))}
      </ul>
    </section>
  );
}

function AnnotationDetailsListItem({
  annotation,
  annotationConfig,
  renderFilterActions,
}: {
  annotation: Annotation;
  annotationConfig?: AnnotationOptimizationConfig;
  renderFilterActions?: (annotation: Annotation) => ReactNode;
}) {
  // Detail rows color their own score rather than the group's mean.
  const positiveOptimization = getPositiveOptimizationFromConfig({
    config: annotationConfig,
    score: annotation.score,
  });
  // Keep the modified time available without adding another visible row.
  const modifiedTitle = annotation.updatedAt
    ? `Modified: ${new Date(annotation.updatedAt).toLocaleString()}`
    : undefined;
  const annotatorKind = annotation.annotatorKind;

  return (
    <li>
      <Flex direction="column" gap="size-100">
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap="size-100"
        >
          <div title={modifiedTitle} css={annotationValueCSS}>
            <Flex
              direction="row"
              alignItems="center"
              gap="size-100"
              minWidth={0}
              flex="1 1 auto"
            >
              {annotation.score != null ? (
                <AnnotationScoreText
                  elementType="span"
                  fontFamily="mono"
                  positiveOptimization={positiveOptimization}
                >
                  {floatFormatter(annotation.score)}
                </AnnotationScoreText>
              ) : null}
              {annotation.label != null ? (
                <View minWidth={0} flex="1 1 auto">
                  <Truncate maxWidth="100%" title={annotation.label}>
                    <Text>{annotation.label}</Text>
                  </Truncate>
                </View>
              ) : null}
              {!hasAnnotationValue(annotation) ? (
                <Text color="text-500">--</Text>
              ) : null}
            </Flex>
          </div>
          <Flex
            css={annotationAuthorCSS}
            direction="row"
            alignItems="center"
            justifyContent="end"
            gap="size-100"
            minWidth={0}
            flex="0 1 auto"
          >
            {isAnnotatorKind(annotatorKind) ? (
              <View flex="none">
                <AnnotatorKindToken kind={annotatorKind} />
              </View>
            ) : annotatorKind ? (
              <View flex="none">
                <Text color="text-500" size="XS">
                  {annotatorKind}
                </Text>
              </View>
            ) : null}
            <UserDisplay
              user={annotation.user}
              profilePictureSize={16}
              maxWidth="160px"
              color="text-500"
            />
          </Flex>
        </Flex>
        {annotation.explanation ? (
          <Truncate maxLines={3} title={annotation.explanation}>
            <Text color="text-500">{annotation.explanation}</Text>
          </Truncate>
        ) : null}
        {renderFilterActions ? renderFilterActions(annotation) : null}
      </Flex>
    </li>
  );
}
