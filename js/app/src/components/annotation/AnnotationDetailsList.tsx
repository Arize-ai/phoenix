import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation/AnnotationColorSwatch";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import { AnnotationScoreText } from "./AnnotationScoreText";
import {
  getPositiveOptimizationFromConfig,
  type AnnotationOptimizationConfig,
} from "./optimizationUtils";
import type { Annotation } from "./types";

const annotationDetailsHeaderCSS = css`
  position: sticky;
  top: 0;
  z-index: 1;
  padding: var(--global-dimension-size-200) var(--global-dimension-size-200)
    var(--global-dimension-size-100);
  background: var(--global-tooltip-background-color);
`;

const annotationListCSS = css`
  list-style: none;
  margin: 0;
  padding: 0 var(--global-dimension-size-200) var(--global-dimension-size-200);

  > li {
    padding-block: var(--global-dimension-size-100);
    border-bottom: 1px solid var(--global-border-color-default);
  }

  > li:last-of-type {
    border-bottom: 0;
    padding-bottom: 0;
  }
`;

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Flex direction="row" justifyContent="space-between" gap="size-200">
      <Text weight="heavy" color="inherit">
        {label}
      </Text>
      {children}
    </Flex>
  );
}

export function AnnotationDetailsList({
  annotations,
  annotationConfig,
}: {
  annotations: readonly Annotation[];
  annotationConfig?: AnnotationOptimizationConfig;
}) {
  const annotationName = annotations[0]?.name;
  if (annotationName == null) {
    return null;
  }

  return (
    <div>
      <Flex
        css={annotationDetailsHeaderCSS}
        direction="row"
        gap="size-100"
        alignItems="center"
      >
        <AnnotationColorSwatch annotationName={annotationName} />
        <Text weight="heavy" color="inherit" size="L" elementType="h3">
          {annotationName}
        </Text>
      </Flex>
      <ul css={annotationListCSS}>
        {annotations.map((annotation, index) => (
          <li key={annotation.id ?? `${annotation.createdAt}-${index}`}>
            <Flex direction="column" gap="size-50">
              <DetailRow label="label">
                <Text color="inherit" title={annotation.label ?? undefined}>
                  <Truncate maxWidth="240px">
                    {annotation.label || "--"}
                  </Truncate>
                </Text>
              </DetailRow>
              <DetailRow label="score">
                <AnnotationScoreText
                  elementType="span"
                  fontFamily="mono"
                  positiveOptimization={getPositiveOptimizationFromConfig({
                    config: annotationConfig,
                    score: annotation.score,
                  })}
                >
                  {floatFormatter(annotation.score)}
                </AnnotationScoreText>
              </DetailRow>
              <DetailRow label="annotator kind">
                <Text color="inherit">{annotation.annotatorKind || "--"}</Text>
              </DetailRow>
              <DetailRow label="author">
                <Text color="inherit">
                  {annotation.user?.username ?? "system"}
                </Text>
              </DetailRow>
              <DetailRow label="created at">
                <Text color="inherit">
                  {annotation.createdAt
                    ? new Date(annotation.createdAt).toLocaleString()
                    : "--"}
                </Text>
              </DetailRow>
              <Flex direction="column" gap="size-25">
                <Text weight="heavy" color="inherit">
                  explanation
                </Text>
                <Text color="inherit">{annotation.explanation || "--"}</Text>
              </Flex>
            </Flex>
          </li>
        ))}
      </ul>
    </div>
  );
}
