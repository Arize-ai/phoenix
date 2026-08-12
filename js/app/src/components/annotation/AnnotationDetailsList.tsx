import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Flex, Text } from "@phoenix/components";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { AnnotatorKindToken } from "@phoenix/components/trace/AnnotatorKindToken";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  getPositiveOptimizationFromConfig,
  type AnnotationOptimizationConfig,
} from "./optimizationUtils";
import type { Annotation } from "./types";

const annotationDetailsHeaderCSS = css`
  min-width: 0;
  padding: var(--global-dimension-size-200);
  border-bottom: 1px solid var(--global-border-color-default);
`;

const annotationNameCSS = css`
  display: block;
  min-width: 0;
  width: 100%;
`;

const annotationListCSS = css`
  list-style: none;
  margin: 0;
  max-height: 400px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0;

  > li {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200);
  }

  > li + li {
    border-top: 1px solid var(--global-border-color-default);
  }
`;

const annotationValueCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  flex: 1 1 auto;
`;

const annotationLabelValueCSS = css`
  min-width: 0;
  flex: 1 1 auto;
`;

const annotationAuthorCSS = css`
  min-width: 0;
  overflow: hidden;
  flex: 0 1 auto;
`;

const annotationAuthorAndActionsCSS = css`
  min-width: 0;
  flex: 0 1 auto;
`;

const annotationUsernameCSS = css`
  min-width: 0;
  flex: 0 1 auto;
`;

const annotationKindCSS = css`
  flex: none;
`;

const explanationCSS = css`
  display: -webkit-box;
  width: 100%;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
`;

export function AnnotationDetailsList({
  annotations,
  annotationConfig,
  renderFilterActions,
}: {
  annotations: readonly Annotation[];
  annotationConfig?: AnnotationOptimizationConfig;
  renderFilterActions?: (
    annotation: Annotation,
    positiveOptimization: boolean | null | undefined
  ) => ReactNode;
}) {
  const annotationName = annotations[0]?.name;
  if (annotationName == null) {
    return null;
  }

  return (
    <div>
      <header css={annotationDetailsHeaderCSS}>
        <Text
          css={annotationNameCSS}
          weight="heavy"
          color="inherit"
          size="L"
          elementType="h3"
          title={annotationName}
        >
          <Truncate maxWidth="100%" title={annotationName}>
            {annotationName}
          </Truncate>
        </Text>
      </header>
      <ul css={annotationListCSS} aria-label={`${annotationName} annotations`}>
        {annotations.map((annotation, index) => {
          const positiveOptimization = getPositiveOptimizationFromConfig({
            config: annotationConfig,
            score: annotation.score,
          });
          const modifiedTitle = annotation.updatedAt
            ? `Modified: ${new Date(annotation.updatedAt).toLocaleString()}`
            : undefined;
          const username = annotation.user?.username ?? "system";
          const hasValue = annotation.score != null || annotation.label != null;
          const annotatorKind = annotation.annotatorKind;
          const isKnownAnnotatorKind =
            annotatorKind === "HUMAN" ||
            annotatorKind === "LLM" ||
            annotatorKind === "CODE";
          return (
            <li key={annotation.id ?? `${annotation.createdAt}-${index}`}>
              <Flex
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap="size-100"
              >
                <div css={annotationValueCSS} title={modifiedTitle}>
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
                    <Text
                      css={annotationLabelValueCSS}
                      title={annotation.label}
                    >
                      <Truncate maxWidth="100%">{annotation.label}</Truncate>
                    </Text>
                  ) : null}
                  {!hasValue ? <Text color="text-500">--</Text> : null}
                </div>
                <Flex
                  css={annotationAuthorAndActionsCSS}
                  direction="row"
                  alignItems="center"
                  justifyContent="end"
                  gap="size-100"
                >
                  <Flex
                    css={annotationAuthorCSS}
                    direction="row"
                    alignItems="center"
                    gap="size-100"
                  >
                    <UserPicture
                      name={annotation.user?.username}
                      profilePictureUrl={annotation.user?.profilePictureUrl}
                      size={16}
                    />
                    <Text css={annotationUsernameCSS} color="text-500">
                      <Truncate maxWidth="160px">{username}</Truncate>
                    </Text>
                    {isKnownAnnotatorKind ? (
                      <span css={annotationKindCSS}>
                        <AnnotatorKindToken kind={annotatorKind} />
                      </span>
                    ) : annotatorKind ? (
                      <Text css={annotationKindCSS} color="text-500" size="XS">
                        {annotatorKind}
                      </Text>
                    ) : null}
                  </Flex>
                  {renderFilterActions
                    ? renderFilterActions(annotation, positiveOptimization)
                    : null}
                </Flex>
              </Flex>
              {annotation.explanation ? (
                <Text
                  css={explanationCSS}
                  color="text-500"
                  title={annotation.explanation}
                >
                  {annotation.explanation}
                </Text>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
