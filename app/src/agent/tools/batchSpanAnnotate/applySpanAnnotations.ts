import { commitMutation, fetchQuery, graphql } from "react-relay";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { applySpanAnnotationsCreateMutation } from "./__generated__/applySpanAnnotationsCreateMutation.graphql";
import type { CreateSpanAnnotationInput } from "./__generated__/applySpanAnnotationsCreateMutation.graphql";
import type { applySpanAnnotationsResolveByNodeIdQuery } from "./__generated__/applySpanAnnotationsResolveByNodeIdQuery.graphql";
import type { applySpanAnnotationsResolveByOtelIdQuery } from "./__generated__/applySpanAnnotationsResolveByOtelIdQuery.graphql";
import type { AnnotateSpanInput } from "./types";

type ResolvedSpanAnnotationTarget = {
  spanNodeId: string;
  filterUserIds: (string | null)[];
};

async function resolveSpanAnnotationTarget(
  annotation: AnnotateSpanInput
): Promise<ResolvedSpanAnnotationTarget> {
  if (annotation.spanNodeId) {
    const data = await fetchQuery<applySpanAnnotationsResolveByNodeIdQuery>(
      RelayEnvironment,
      graphql`
        query applySpanAnnotationsResolveByNodeIdQuery($spanNodeId: ID!) {
          viewer {
            id
          }
          span: node(id: $spanNodeId) {
            __typename
            ... on Span {
              id
            }
          }
        }
      `,
      { spanNodeId: annotation.spanNodeId }
    ).toPromise();
    if (data?.span?.__typename !== "Span") {
      throw new Error("Could not resolve spanNodeId to a span.");
    }
    return {
      spanNodeId: data.span.id,
      filterUserIds: [data.viewer?.id ?? null],
    };
  }

  if (annotation.spanId) {
    const data = await fetchQuery<applySpanAnnotationsResolveByOtelIdQuery>(
      RelayEnvironment,
      graphql`
        query applySpanAnnotationsResolveByOtelIdQuery($spanId: String!) {
          viewer {
            id
          }
          span: getSpanByOtelId(spanId: $spanId) {
            id
          }
        }
      `,
      { spanId: annotation.spanId }
    ).toPromise();
    if (!data?.span?.id) {
      throw new Error("Could not resolve spanId to a span.");
    }
    return {
      spanNodeId: data.span.id,
      filterUserIds: [data.viewer?.id ?? null],
    };
  }

  throw new Error(
    "batch_span_annotate requires spanId or spanNodeId so PXI knows which span to annotate."
  );
}

function buildCreateSpanAnnotationInput({
  annotation,
  target,
}: {
  annotation: AnnotateSpanInput;
  target: ResolvedSpanAnnotationTarget;
}): CreateSpanAnnotationInput {
  return {
    spanId: target.spanNodeId,
    name: annotation.name,
    annotatorKind: annotation.annotatorKind,
    label: annotation.label,
    score: annotation.score,
    explanation: annotation.explanation,
    source: "APP",
    metadata: annotation.metadata ?? {},
    ...(annotation.identifier != null
      ? { identifier: annotation.identifier }
      : {}),
  };
}

function commitCreateSpanAnnotations({
  inputs,
  filterUserIds,
}: {
  inputs: CreateSpanAnnotationInput[];
  filterUserIds: (string | null)[];
}): Promise<void> {
  return new Promise((resolve, reject) => {
    commitMutation<applySpanAnnotationsCreateMutation>(RelayEnvironment, {
      mutation: graphql`
        mutation applySpanAnnotationsCreateMutation(
          $input: [CreateSpanAnnotationInput!]!
          $filterUserIds: [ID]
        ) {
          createSpanAnnotations(input: $input) {
            spanAnnotations {
              span {
                id
                __typename
                ...AnnotationSummaryGroup
                ...TraceHeaderRootSpanAnnotationsFragment
                ...SpanAnnotationsEditor_spanAnnotations
                  @arguments(filterUserIds: $filterUserIds)
                ...SpanFeedback_annotations
              }
            }
          }
        }
      `,
      variables: {
        filterUserIds,
        input: inputs,
      },
      onCompleted: (_response, errors) => {
        const message = errors?.find((error) => error.message)?.message;
        if (message) {
          reject(new Error(message));
          return;
        }
        resolve();
      },
      onError: reject,
    });
  });
}

async function resolveSpanAnnotationTargets(
  annotations: AnnotateSpanInput[]
): Promise<ResolvedSpanAnnotationTarget[]> {
  const targets: ResolvedSpanAnnotationTarget[] = [];
  for (const [index, annotation] of annotations.entries()) {
    try {
      targets.push(await resolveSpanAnnotationTarget(annotation));
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Failed to resolve annotation target.";
      throw new Error(
        `Failed to resolve target for annotation "${annotation.name}" at index ${index}: ${reason}`
      );
    }
  }
  return targets;
}

function validateSpanAnnotationValues(annotations: AnnotateSpanInput[]): void {
  if (annotations.length === 0) {
    throw new Error("batch_span_annotate requires at least one annotation.");
  }

  for (const [index, annotation] of annotations.entries()) {
    if (
      annotation.label == null &&
      annotation.score == null &&
      annotation.explanation == null
    ) {
      throw new Error(
        `Failed to validate annotation "${annotation.name}" at index ${index}: batch_span_annotate requires at least one of label, score, or explanation per annotation.`
      );
    }
  }
}

/**
 * Applies all span annotations in one server mutation after every target has
 * resolved. The server mutation processes the list in one database transaction,
 * so a failed item does not leave earlier items silently committed.
 */
export async function applySpanAnnotations(
  annotations: AnnotateSpanInput[]
): Promise<void> {
  validateSpanAnnotationValues(annotations);
  const targets = await resolveSpanAnnotationTargets(annotations);
  const inputs = annotations.map((annotation, index) =>
    buildCreateSpanAnnotationInput({
      annotation,
      target: targets[index]!,
    })
  );
  await commitCreateSpanAnnotations({
    inputs,
    filterUserIds: targets[0]?.filterUserIds ?? [null],
  });
}
