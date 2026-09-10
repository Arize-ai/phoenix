import type { ReactNode } from "react";

import {
  Badge,
  Flex,
  Icon,
  Icons,
  Link,
  OverflowRow,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationSummaryTokens } from "@phoenix/components/annotation/AnnotationSummaryTokens";
import {
  groupAnnotationsByName,
  hasAnnotationValue,
} from "@phoenix/components/annotation/annotationUtils";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import type {
  Annotation,
  AnnotationTargetType,
} from "@phoenix/components/annotation/types";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { assertUnreachable } from "@phoenix/typeUtils";

/** How many leading characters of the target's id the badge shows. */
const ID_BADGE_LENGTH = 8;

type AnnotationFields = Annotation & {
  id: string;
  createdAt: string;
};

type ParsedEvaluatorOutputAnnotation = AnnotationFields;

export type EvaluatorResultAnnotation =
  | (AnnotationFields & {
      __typename: "SpanAnnotation";
      span: {
        id: string;
        trace: {
          traceId: string;
          project: { id: string };
        };
      };
    })
  | (AnnotationFields & {
      __typename: "TraceAnnotation";
      trace: {
        traceId: string;
        project: { id: string };
      };
    })
  | (AnnotationFields & {
      __typename: "ProjectSessionAnnotation";
      projectSession: {
        id: string;
        project: { id: string };
      };
    });

type EvaluatorResultAnnotationData = {
  readonly __typename: string;
  readonly id?: string;
  readonly name?: string;
  readonly label?: string | null;
  readonly score?: number | null;
  readonly explanation?: string | null;
  readonly annotatorKind?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly user?: {
    readonly username: string;
    readonly profilePictureUrl?: string | null;
  } | null;
  readonly span?: {
    readonly id: string;
    readonly trace: {
      readonly traceId: string;
      readonly project: { readonly id: string };
    };
  };
  readonly trace?: {
    readonly traceId: string;
    readonly project: { readonly id: string };
  };
  readonly projectSession?: {
    readonly id: string;
    readonly project: { readonly id: string };
  };
};

function isEvaluatorResultAnnotation(
  annotation: EvaluatorResultAnnotationData
): annotation is EvaluatorResultAnnotation {
  const hasAnnotationIdentity =
    typeof annotation.id === "string" &&
    typeof annotation.name === "string" &&
    typeof annotation.createdAt === "string";
  if (!hasAnnotationIdentity) {
    return false;
  }
  switch (annotation.__typename) {
    case "SpanAnnotation":
      return annotation.span != null;
    case "TraceAnnotation":
      return annotation.trace != null;
    case "ProjectSessionAnnotation":
      return annotation.projectSession != null;
    default:
      return false;
  }
}

type EvaluatorResultTarget = {
  annotationTargetType: AnnotationTargetType;
  label: string;
  path: string;
  /** The target's own identifier, shown as the clickable link text. */
  id: string;
};

type EvaluatorOutputResult = {
  name?: unknown;
  label?: unknown;
  score?: unknown;
  explanation?: unknown;
};

function parseOutputResult({
  result,
  fallbackName,
  sourceId,
  createdAt,
  index,
}: {
  result: EvaluatorOutputResult;
  fallbackName?: string;
  sourceId: string;
  createdAt: string;
  index: number;
}): ParsedEvaluatorOutputAnnotation | null {
  const name = typeof result.name === "string" ? result.name : fallbackName;
  const label = typeof result.label === "string" ? result.label : null;
  const score =
    typeof result.score === "number" && Number.isFinite(result.score)
      ? result.score
      : null;
  if (!name || (label == null && score == null)) {
    return null;
  }
  return {
    id: `${sourceId}:result:${index}`,
    name,
    label,
    score,
    explanation:
      typeof result.explanation === "string" ? result.explanation : null,
    createdAt,
  };
}

/** Parse the successful evaluator-span output formats used before and after structured results. */
export function parseEvaluatorOutput({
  output,
  annotationNames,
  sourceId,
  createdAt,
}: {
  output: string | null | undefined;
  annotationNames: readonly string[];
  sourceId: string;
  createdAt: string;
}): ParsedEvaluatorOutputAnnotation[] {
  const trimmedOutput = output?.trim();
  if (!trimmedOutput) {
    return [];
  }

  try {
    const parsedOutput: unknown = JSON.parse(trimmedOutput);
    if (
      parsedOutput != null &&
      typeof parsedOutput === "object" &&
      "results" in parsedOutput &&
      Array.isArray(parsedOutput.results)
    ) {
      return parsedOutput.results.flatMap((result, index) => {
        if (result == null || typeof result !== "object") {
          return [];
        }
        const annotation = parseOutputResult({
          result,
          fallbackName: annotationNames[index],
          sourceId,
          createdAt,
          index,
        });
        return annotation ? [annotation] : [];
      });
    }
  } catch {
    // Legacy evaluator spans used a compact human-readable output.
  }

  const annotationName =
    annotationNames.length === 1 ? annotationNames[0] : null;
  if (!annotationName) {
    return [];
  }
  const [valueLine, ...explanationParts] = trimmedOutput.split(/\r?\n\r?\n/);
  if (!valueLine) {
    return [];
  }
  const valueMatch = valueLine.match(
    /^(?:(.*?)\s+)?\(score=([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)\)$/
  );
  const label =
    valueMatch?.[1]?.trim() || (valueMatch ? null : valueLine.trim());
  const score = valueMatch ? Number(valueMatch[2]) : null;
  if (!label && score == null) {
    return [];
  }
  return [
    {
      id: `${sourceId}:result:0`,
      name: annotationName,
      label,
      score,
      explanation: explanationParts.join("\n\n").trim() || null,
      createdAt,
    },
  ];
}

export function getEvaluatorResultTarget(
  annotation: EvaluatorResultAnnotation
): EvaluatorResultTarget {
  switch (annotation.__typename) {
    case "SpanAnnotation": {
      const searchParams = new URLSearchParams({
        [SELECTED_SPAN_NODE_ID_PARAM]: annotation.span.id,
      });
      return {
        annotationTargetType: "span",
        label: "View annotated span",
        path: `/projects/${encodeURIComponent(
          annotation.span.trace.project.id
        )}/spans/${encodeURIComponent(
          annotation.span.trace.traceId
        )}?${searchParams.toString()}`,
        id: annotation.span.trace.traceId,
      };
    }
    case "TraceAnnotation":
      return {
        annotationTargetType: "trace",
        label: "View annotated trace",
        path: `/projects/${encodeURIComponent(
          annotation.trace.project.id
        )}/traces/${encodeURIComponent(annotation.trace.traceId)}`,
        id: annotation.trace.traceId,
      };
    case "ProjectSessionAnnotation":
      return {
        annotationTargetType: "session",
        label: "View annotated session",
        path: `/projects/${encodeURIComponent(
          annotation.projectSession.project.id
        )}/sessions/${encodeURIComponent(annotation.projectSession.id)}`,
        id: annotation.projectSession.id,
      };
    default:
      return assertUnreachable(annotation);
  }
}

export function EvaluatorOutputCell({
  annotations,
  annotationConfigsByName,
  annotationNames,
  annotationTargetType,
  output,
  sourceId,
  createdAt,
  isSuccessful,
  fallback,
  isExpanded,
}: {
  annotations: readonly EvaluatorResultAnnotationData[];
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  annotationNames: readonly string[];
  annotationTargetType: AnnotationTargetType;
  output: string | null | undefined;
  sourceId: string;
  createdAt: string;
  isSuccessful: boolean;
  fallback: ReactNode;
  isExpanded: boolean;
}) {
  const resultAnnotations = annotations.filter(isEvaluatorResultAnnotation);
  const linkedAnnotation = resultAnnotations.find(hasAnnotationValue);
  const displayAnnotations = linkedAnnotation
    ? resultAnnotations
    : isSuccessful
      ? parseEvaluatorOutput({ output, annotationNames, sourceId, createdAt })
      : [];
  if (!displayAnnotations.some(hasAnnotationValue)) {
    return fallback;
  }

  const annotationsByName = groupAnnotationsByName(displayAnnotations);
  const summaries = Object.keys(annotationsByName)
    .sort((firstName, secondName) => firstName.localeCompare(secondName))
    .flatMap((name) => {
      const annotation = annotationsByName[name]?.[0];
      return annotation
        ? [
            {
              name,
              meanScore: annotation.score,
              labelFractions: annotation.label
                ? [{ label: annotation.label, fraction: 1 }]
                : [],
            },
          ]
        : [];
    });
  const target = linkedAnnotation
    ? getEvaluatorResultTarget(linkedAnnotation)
    : null;

  return (
    <Flex direction="row" alignItems="center" gap="size-100" minWidth={0}>
      <View minWidth={0} flex="1 1 auto">
        <OverflowRow isExpanded={isExpanded}>
          <AnnotationSummaryTokens
            summaries={summaries}
            annotationTargetType={
              target?.annotationTargetType ?? annotationTargetType
            }
            annotationsByName={annotationsByName}
            annotationConfigsByName={annotationConfigsByName}
          />
        </OverflowRow>
      </View>
      {target ? (
        <StopPropagation>
          <Flex
            direction="row"
            alignItems="center"
            gap="size-50"
            minWidth={0}
            flex="none"
          >
            <Icon svg={<Icons.ArrowRight />} aria-hidden="true" />
            <Link to={target.path} aria-label={target.label}>
              <Badge size="S">
                <Text fontFamily="mono" size="S">
                  {target.id.slice(0, ID_BADGE_LENGTH)}
                </Text>
              </Badge>
            </Link>
          </Flex>
        </StopPropagation>
      ) : null}
    </Flex>
  );
}
