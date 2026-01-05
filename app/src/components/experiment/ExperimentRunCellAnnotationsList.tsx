import { useMemo } from "react";
import { css } from "@emotion/react";

import {
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  Popover,
  PopoverArrow,
  Separator,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import {
  Annotation,
  type AnnotationConfig,
} from "@phoenix/components/annotation";
import { AnnotationDetailsContent } from "@phoenix/components/annotation/AnnotationDetailsContent";
import { ExperimentAnnotationButton } from "@phoenix/components/experiment/ExperimentAnnotationButton";
import { ExperimentRunAnnotationFiltersList } from "@phoenix/pages/experiment/ExperimentRunAnnotationFiltersList";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

type AnnotationSummary = {
  readonly annotationName: string;
  readonly meanScore: number | null;
};

type AnnotationWithTrace = Annotation & {
  trace?: {
    traceId: string;
    projectId: string;
  } | null;
};

export type ExperimentRunCellAnnotationsListProps = {
  annotations: readonly AnnotationWithTrace[];
  annotationSummaries?: readonly AnnotationSummary[];
  annotationOutputConfigs?: readonly AnnotationConfig[];
  numRepetitions?: number;
  onTraceClick: ({
    annotationName,
    traceId,
    projectId,
  }: {
    annotationName: string;
    traceId: string;
    projectId: string;
  }) => void;
  renderFilters?: boolean;
};

export function ExperimentRunCellAnnotationsList(
  props: ExperimentRunCellAnnotationsListProps
) {
  const {
    annotations,
    annotationSummaries,
    annotationOutputConfigs,
    onTraceClick,
    numRepetitions = 1,
    renderFilters,
  } = props;

  const annotationSummaryByAnnotationName = useMemo(() => {
    return (
      annotationSummaries?.reduce(
        (acc, summary) => {
          acc[summary.annotationName] = summary;
          return acc;
        },
        {} as Record<string, AnnotationSummary>
      ) ?? {}
    );
  }, [annotationSummaries]);

  const annotationOutputConfigsByName = useMemo(() => {
    return (
      annotationOutputConfigs?.reduce(
        (acc, config) => {
          acc[config.name] = config;
          return acc;
        },
        {} as Record<string, AnnotationConfig>
      ) ?? {}
    );
  }, [annotationOutputConfigs]);

  if (!annotations || annotations.length === 0) {
    return null;
  }

  return (
    <ul
      css={css`
        display: flex;
        flex-direction: column;
        flex: none;
        padding: 0 var(--ac-global-dimension-static-size-100)
          var(--ac-global-dimension-static-size-100)
          var(--ac-global-dimension-static-size-100);
      `}
    >
      {annotations.map((annotation) => {
        const traceId = annotation.trace?.traceId;
        const projectId = annotation.trace?.projectId;
        const hasTrace = traceId != null && projectId != null;
        const meanAnnotationScore =
          annotationSummaryByAnnotationName[annotation.name]?.meanScore;
        const annotationOutputConfig: AnnotationConfig | undefined =
          annotationOutputConfigsByName[annotation.name];
        const optimizationDirection =
          annotationOutputConfig?.annotationType !== "FREEFORM"
            ? annotationOutputConfig?.optimizationDirection
            : undefined;
        const lowerOptimizationBound =
          annotationOutputConfig?.annotationType === "CONTINUOUS"
            ? annotationOutputConfig.lowerBound
            : annotationOutputConfig.annotationType === "CATEGORICAL"
              ? annotationOutputConfig.values?.reduce((acc, value) => {
                  if (value.score == null) {
                    return acc;
                  }
                  return value.score < acc ? value.score : acc;
                }, Infinity)
              : undefined;
        const upperOptimizationBound =
          annotationOutputConfig?.annotationType === "CONTINUOUS"
            ? annotationOutputConfig.upperBound
            : annotationOutputConfig.annotationType === "CATEGORICAL"
              ? annotationOutputConfig.values?.reduce((acc, value) => {
                  if (value.score == null) {
                    return acc;
                  }
                  return value.score > acc ? value.score : acc;
                }, -Infinity)
              : undefined;
        // if the score exists, calculate if it is in the upper half or bottom half of the optimization bounds
        // if postitive optimization is false, assume it is a negative optimization, and exists in the bottom half of the optimization bounds
        // if positive optimization is null, assume we cannot determine if it is a positive or negative optimization
        const positiveOptimization: boolean | null =
          annotation.score != null &&
          upperOptimizationBound != null &&
          lowerOptimizationBound != null
            ? // we have all of the ingredients to determine if it is a positive optimization
              optimizationDirection === "MAXIMIZE"
              ? annotation.score >= upperOptimizationBound
              : annotation.score <= lowerOptimizationBound
            : // we do not have all of the ingredients to determine if it is a positive optimization
              null;
        return (
          <li
            key={annotation.id}
            css={css`
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              gap: var(--ac-global-dimension-static-size-50);
            `}
          >
            <DialogTrigger>
              <ExperimentAnnotationButton
                annotation={annotation}
                positiveOptimization={positiveOptimization ?? undefined}
                extra={
                  meanAnnotationScore != null && numRepetitions > 1 ? (
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <Text fontFamily="mono">
                        {floatFormatter(meanAnnotationScore)}
                      </Text>
                      <Text fontFamily="mono" color="grey-500">
                        AVG
                      </Text>
                    </Flex>
                  ) : null
                }
              />
              <Popover placement="top">
                <PopoverArrow />
                <Dialog style={{ width: 400 }}>
                  <View padding="size-200">
                    <Flex direction="column" gap="size-50">
                      <AnnotationDetailsContent
                        annotation={annotation}
                        positiveOptimization={positiveOptimization ?? undefined}
                      />
                      {renderFilters && (
                        <>
                          <Separator />
                          <section>
                            <Heading level={4} weight="heavy">
                              Filters
                            </Heading>
                            <ExperimentRunAnnotationFiltersList
                              annotation={annotation}
                            />
                          </section>
                        </>
                      )}
                    </Flex>
                  </View>
                </Dialog>
              </Popover>
            </DialogTrigger>
            <TooltipTrigger>
              <IconButton
                size="S"
                onPress={() => {
                  if (hasTrace) {
                    onTraceClick({
                      annotationName: annotation.name,
                      traceId,
                      projectId,
                    });
                  }
                }}
                isDisabled={!hasTrace}
              >
                <Icon svg={<Icons.Trace />} />
              </IconButton>
              <Tooltip>
                <TooltipArrow />
                View evaluation trace
              </Tooltip>
            </TooltipTrigger>
          </li>
        );
      })}
    </ul>
  );
}
