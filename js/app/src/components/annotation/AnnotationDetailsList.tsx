import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Flex, Text, View } from "@phoenix/components";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { AnnotatorKindToken } from "@phoenix/components/trace/AnnotatorKindToken";
import { UserPicture } from "@phoenix/components/user/UserPicture";
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

type AnnotationDetailsFilterActionsRenderProps = {
  annotation: Annotation;
  positiveOptimization: boolean | null | undefined;
};

export function AnnotationDetailsList({
  annotations,
  annotationConfig,
  renderFilterActions,
}: {
  annotations: readonly Annotation[];
  annotationConfig?: AnnotationOptimizationConfig;
  renderFilterActions?: (
    props: AnnotationDetailsFilterActionsRenderProps
  ) => ReactNode;
}) {
  const annotationName = annotations[0]?.name;
  if (annotationName == null) {
    return null;
  }

  return (
    <div>
      <View
        elementType="header"
        minWidth={0}
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="default"
      >
        <Truncate maxWidth="100%" title={annotationName}>
          <Text weight="heavy" color="inherit" size="L" elementType="h3">
            {annotationName}
          </Text>
        </Truncate>
      </View>
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
          const annotatorKind = annotation.annotatorKind;
          return (
            <Flex
              elementType="li"
              direction="column"
              gap="size-100"
              key={annotation.id ?? `${annotation.createdAt}-${index}`}
            >
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
                  direction="row"
                  alignItems="center"
                  justifyContent="end"
                  gap="size-100"
                  minWidth={0}
                  flex="0 1 auto"
                >
                  <Flex
                    css={annotationAuthorCSS}
                    direction="row"
                    alignItems="center"
                    gap="size-100"
                    minWidth={0}
                    flex="0 1 auto"
                  >
                    <UserPicture
                      name={annotation.user?.username}
                      profilePictureUrl={annotation.user?.profilePictureUrl}
                      size={16}
                    />
                    <View minWidth={0} maxWidth="160px" flex="0 1 auto">
                      <Truncate maxWidth="100%" title={username}>
                        <Text color="text-500">{username}</Text>
                      </Truncate>
                    </View>
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
                  </Flex>
                  {renderFilterActions
                    ? renderFilterActions({
                        annotation,
                        positiveOptimization,
                      })
                    : null}
                </Flex>
              </Flex>
              {annotation.explanation ? (
                <Truncate maxLines={3} title={annotation.explanation}>
                  <Text color="text-500">{annotation.explanation}</Text>
                </Truncate>
              ) : null}
            </Flex>
          );
        })}
      </ul>
    </div>
  );
}
