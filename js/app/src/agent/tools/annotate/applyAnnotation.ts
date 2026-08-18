import { commitMutation, fetchQuery, graphql } from "react-relay";

import { applySpanAnnotations } from "@phoenix/agent/tools/batchSpanAnnotate";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { applyAnnotationCreateSessionMutation } from "./__generated__/applyAnnotationCreateSessionMutation.graphql";
import type { applyAnnotationCreateTraceMutation } from "./__generated__/applyAnnotationCreateTraceMutation.graphql";
import type { applyAnnotationResolveSessionByIdQuery } from "./__generated__/applyAnnotationResolveSessionByIdQuery.graphql";
import type { applyAnnotationResolveSessionByNodeIdQuery } from "./__generated__/applyAnnotationResolveSessionByNodeIdQuery.graphql";
import type { applyAnnotationResolveTraceByNodeIdQuery } from "./__generated__/applyAnnotationResolveTraceByNodeIdQuery.graphql";
import type { applyAnnotationResolveTraceByOtelIdQuery } from "./__generated__/applyAnnotationResolveTraceByOtelIdQuery.graphql";
import type { AnnotateApplyResult, AnnotateInput } from "./types";

type ResolvedAnnotationTarget = {
  nodeId: string;
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function commitRelayMutation<TMutation extends { variables: object }>(
  mutation: Parameters<typeof commitMutation<TMutation>>[1]["mutation"],
  variables: TMutation["variables"]
): Promise<void> {
  return new Promise((resolve, reject) => {
    commitMutation<TMutation>(RelayEnvironment, {
      mutation,
      variables,
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

async function resolveTraceTarget(
  annotation: Extract<AnnotateInput, { target: "trace" }>
): Promise<ResolvedAnnotationTarget> {
  if ("traceNodeId" in annotation) {
    const data = await fetchQuery<applyAnnotationResolveTraceByNodeIdQuery>(
      RelayEnvironment,
      graphql`
        query applyAnnotationResolveTraceByNodeIdQuery($traceNodeId: ID!) {
          trace: node(id: $traceNodeId) {
            __typename
            ... on Trace {
              id
            }
          }
        }
      `,
      { traceNodeId: annotation.traceNodeId }
    ).toPromise();
    if (data?.trace?.__typename !== "Trace" || !("id" in data.trace)) {
      throw new Error("Could not resolve traceNodeId to a trace.");
    }
    return { nodeId: data.trace.id };
  }

  const data = await fetchQuery<applyAnnotationResolveTraceByOtelIdQuery>(
    RelayEnvironment,
    graphql`
      query applyAnnotationResolveTraceByOtelIdQuery($traceId: String!) {
        trace: getTraceByOtelId(traceId: $traceId) {
          id
        }
      }
    `,
    { traceId: annotation.traceId }
  ).toPromise();
  if (!data?.trace?.id) {
    throw new Error("Could not resolve traceId to a trace.");
  }
  return { nodeId: data.trace.id };
}

async function resolveSessionTarget(
  annotation: Extract<AnnotateInput, { target: "session" }>
): Promise<ResolvedAnnotationTarget> {
  if ("sessionNodeId" in annotation) {
    const data = await fetchQuery<applyAnnotationResolveSessionByNodeIdQuery>(
      RelayEnvironment,
      graphql`
        query applyAnnotationResolveSessionByNodeIdQuery($sessionNodeId: ID!) {
          session: node(id: $sessionNodeId) {
            __typename
            ... on ProjectSession {
              id
            }
          }
        }
      `,
      { sessionNodeId: annotation.sessionNodeId }
    ).toPromise();
    if (
      data?.session?.__typename !== "ProjectSession" ||
      !("id" in data.session)
    ) {
      throw new Error("Could not resolve sessionNodeId to a session.");
    }
    return { nodeId: data.session.id };
  }

  const data = await fetchQuery<applyAnnotationResolveSessionByIdQuery>(
    RelayEnvironment,
    graphql`
      query applyAnnotationResolveSessionByIdQuery($sessionId: String!) {
        session: getProjectSessionById(sessionId: $sessionId) {
          id
        }
      }
    `,
    { sessionId: annotation.sessionId }
  ).toPromise();
  if (!data?.session?.id) {
    throw new Error("Could not resolve sessionId to a session.");
  }
  return { nodeId: data.session.id };
}

function sharedAnnotationFields(annotation: AnnotateInput) {
  return {
    name: annotation.name,
    annotatorKind: annotation.annotatorKind,
    label: annotation.label,
    score: annotation.score,
    explanation: annotation.explanation,
    source: "APP" as const,
    metadata: annotation.metadata ?? {},
    ...(annotation.identifier != null
      ? { identifier: annotation.identifier }
      : {}),
  };
}

async function applySpanAnnotation(
  annotation: Extract<AnnotateInput, { target: "span" }>
): Promise<void> {
  await applySpanAnnotations([
    {
      ...("spanId" in annotation
        ? { spanId: annotation.spanId }
        : { spanNodeId: annotation.spanNodeId }),
      name: annotation.name,
      annotatorKind: annotation.annotatorKind,
      label: annotation.label,
      score: annotation.score,
      explanation: annotation.explanation,
      identifier: annotation.identifier,
      metadata: annotation.metadata,
    },
  ]);
}

async function applyTraceAnnotation(
  annotation: Extract<AnnotateInput, { target: "trace" }>
): Promise<void> {
  const target = await resolveTraceTarget(annotation);
  await commitRelayMutation<applyAnnotationCreateTraceMutation>(
    graphql`
      mutation applyAnnotationCreateTraceMutation(
        $input: [CreateTraceAnnotationInput!]!
        $traceId: ID!
      ) {
        createTraceAnnotations(input: $input) {
          query {
            node(id: $traceId) {
              ... on Trace {
                ...TraceAnnotationSummaryGroup
                ...TraceHeaderTraceAnnotationsFragment
              }
            }
          }
        }
      }
    `,
    {
      traceId: target.nodeId,
      input: [
        {
          traceId: target.nodeId,
          ...sharedAnnotationFields(annotation),
        },
      ],
    }
  );
}

async function applySessionAnnotation(
  annotation: Extract<AnnotateInput, { target: "session" }>
): Promise<void> {
  const target = await resolveSessionTarget(annotation);
  await commitRelayMutation<applyAnnotationCreateSessionMutation>(
    graphql`
      mutation applyAnnotationCreateSessionMutation(
        $input: CreateProjectSessionAnnotationInput!
        $sessionId: ID!
      ) {
        createProjectSessionAnnotations(input: $input) {
          query {
            node(id: $sessionId) {
              ... on ProjectSession {
                ...SessionAnnotationsEditor_sessionAnnotations
                ...SessionAnnotationsTable_annotations
                ...SessionAnnotationSummaryGroup
              }
            }
          }
        }
      }
    `,
    {
      sessionId: target.nodeId,
      input: {
        projectSessionId: target.nodeId,
        ...sharedAnnotationFields(annotation),
      },
    }
  );
}

function describeAppliedAnnotation(annotation: AnnotateInput): string {
  const outcome =
    annotation.label != null
      ? `${annotation.name}: ${annotation.label}`
      : annotation.name;
  return `Applied ${annotation.target} annotation "${outcome}".`;
}

/**
 * Creates one span, trace, or session annotation through the existing GraphQL
 * annotation mutations after resolving the target to a node ID.
 */
export async function applyAnnotation(
  annotation: AnnotateInput
): Promise<AnnotateApplyResult> {
  try {
    if (annotation.target === "span") {
      await applySpanAnnotation(annotation);
    } else if (annotation.target === "trace") {
      await applyTraceAnnotation(annotation);
    } else {
      await applySessionAnnotation(annotation);
    }
    return { ok: true, output: describeAppliedAnnotation(annotation) };
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error, "Failed to apply the annotation."),
    };
  }
}
