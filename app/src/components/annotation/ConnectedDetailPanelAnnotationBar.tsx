import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";
import type { PreloadedQuery } from "react-relay";
import {
  graphql,
  useLazyLoadQuery,
  useMutation,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import { readInlineData } from "relay-runtime";

import type { Annotation } from "@phoenix/components/annotation";
import type { ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarAnnotationFields$key } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarAnnotationFields.graphql";
import type { ConnectedDetailPanelAnnotationBarConfigFields$key } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarConfigFields.graphql";
import type {
  AnnotationConfigInput,
  ConnectedDetailPanelAnnotationBarCreateConfigMutation,
} from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarCreateConfigMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarSessionQuery } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarSessionQuery.graphql";
import type { ConnectedDetailPanelAnnotationBarSpanQuery } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarSpanQuery.graphql";
import type { ConnectedDetailPanelAnnotationBarTraceAnnotationFields$key } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarTraceAnnotationFields.graphql";
import type { ConnectedDetailPanelAnnotationBarTraceQuery } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarTraceQuery.graphql";
import type { ConnectedDetailPanelAnnotationBarUpdateConfigMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarUpdateConfigMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation.graphql";
import {
  type AnnotationBarCreateResult,
  type AnnotationBarMutationResult,
  type AnnotationBarRow,
  type AnnotationBarTarget,
  type AnnotationValueDraft,
  DetailPanelAnnotationButton,
  DetailPanelAnnotationBar,
} from "@phoenix/components/annotation/DetailPanelAnnotationBar";
import type { AnnotationConfig } from "@phoenix/pages/settings/types";
import { assertUnreachable } from "@phoenix/typeUtils";

const annotationConfigFields = graphql`
  fragment ConnectedDetailPanelAnnotationBarConfigFields on AnnotationConfigBase
  @inline {
    __typename
    ... on Node {
      id
    }
    name
    description
    annotationType
    ... on CategoricalAnnotationConfig {
      optimizationDirection
      values {
        label
        score
      }
    }
    ... on ContinuousAnnotationConfig {
      lowerBound
      upperBound
      optimizationDirection
    }
    ... on FreeformAnnotationConfig {
      optimizationDirection
      threshold
    }
  }
`;

const annotationFields = graphql`
  fragment ConnectedDetailPanelAnnotationBarAnnotationFields on Annotation
  @inline {
    ... on Node {
      id
    }
    name
    label
    score
    explanation
    metadata
    annotatorKind
    source
    createdAt
    user {
      id
      username
      profilePictureUrl
    }
  }
`;

type DetailPanelAnnotationBarVariant = ComponentProps<
  typeof DetailPanelAnnotationBar
>["variant"];

const traceAnnotationFields = graphql`
  fragment ConnectedDetailPanelAnnotationBarTraceAnnotationFields on TraceAnnotation
  @inline {
    id
    name
    label
    score
    explanation
    metadata
    annotatorKind
    source
    createdAt
    user {
      id
      username
      profilePictureUrl
    }
  }
`;

function getAnnotationConfigInput(
  config: AnnotationConfig
): AnnotationConfigInput {
  switch (config.annotationType) {
    case "CATEGORICAL":
      return {
        categorical: {
          name: config.name,
          description: config.description,
          optimizationDirection: config.optimizationDirection ?? "NONE",
          values: config.values ?? [],
        },
      };
    case "CONTINUOUS":
      return {
        continuous: {
          name: config.name,
          description: config.description,
          optimizationDirection: config.optimizationDirection ?? "NONE",
          lowerBound: config.lowerBound,
          upperBound: config.upperBound,
        },
      };
    case "FREEFORM":
      return {
        freeform: {
          name: config.name,
          description: config.description,
          optimizationDirection: config.optimizationDirection,
          threshold: config.threshold,
          lowerBound: config.lowerBound,
          upperBound: config.upperBound,
        },
      };
    default:
      return assertUnreachable(config);
  }
}

function getMutationError(error: Error) {
  return error.message || "The annotation change could not be saved.";
}

export function getAnnotations(
  annotations: readonly ConnectedDetailPanelAnnotationBarAnnotationFields$key[]
): Annotation[] {
  return annotations.map((annotationReference) => {
    const annotation = readInlineData(annotationFields, annotationReference);
    return {
      id: annotation.id,
      name: annotation.name,
      label: annotation.label,
      score: annotation.score,
      explanation: annotation.explanation,
      metadata: annotation.metadata,
      annotatorKind: annotation.annotatorKind,
      source: annotation.source,
      createdAt: annotation.createdAt,
      user: annotation.user,
    };
  });
}

function getTraceAnnotations(
  annotations: readonly ConnectedDetailPanelAnnotationBarTraceAnnotationFields$key[]
): Annotation[] {
  return annotations.map((annotationReference) => {
    const annotation = readInlineData(
      traceAnnotationFields,
      annotationReference
    );
    return {
      id: annotation.id,
      name: annotation.name,
      label: annotation.label,
      score: annotation.score,
      explanation: annotation.explanation,
      metadata: annotation.metadata,
      annotatorKind: annotation.annotatorKind,
      source: annotation.source,
      createdAt: annotation.createdAt,
      user: annotation.user,
    };
  });
}

export function getAnnotationConfig(
  configReference: ConnectedDetailPanelAnnotationBarConfigFields$key
): AnnotationConfig {
  const config = readInlineData(annotationConfigFields, configReference);
  if (!config.id) {
    throw new Error("Expected annotation configuration to implement Node");
  }
  const shared = {
    id: config.id,
    name: config.name,
    description: config.description,
  };
  switch (config.annotationType) {
    case "CATEGORICAL":
      return {
        ...shared,
        annotationType: "CATEGORICAL",
        optimizationDirection: config.optimizationDirection ?? "NONE",
        values: (config.values ?? []).map((value) => ({ ...value })),
      };
    case "CONTINUOUS":
      return {
        ...shared,
        annotationType: "CONTINUOUS",
        optimizationDirection: config.optimizationDirection ?? "NONE",
        lowerBound: config.lowerBound ?? null,
        upperBound: config.upperBound ?? null,
      };
    case "FREEFORM":
      return {
        ...shared,
        annotationType: "FREEFORM",
        optimizationDirection: config.optimizationDirection ?? undefined,
        threshold: config.threshold,
      };
    default:
      return assertUnreachable(config.annotationType);
  }
}

type ConfigMutationHandlers = Pick<
  ComponentProps<typeof DetailPanelAnnotationBar>,
  | "onAddAnnotationConfigToProject"
  | "onCreateAnnotationConfig"
  | "onRemoveAnnotationConfigFromProject"
  | "onUpdateAnnotationConfig"
>;

export function useAnnotationConfigMutationHandlers({
  projectId,
  refresh,
}: {
  projectId: string;
  refresh: () => void;
}): ConfigMutationHandlers {
  const [addConfig] =
    useMutation<ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarAddConfigToProjectMutation(
        $projectId: ID!
        $configId: ID!
      ) {
        addAnnotationConfigToProject(
          input: { projectId: $projectId, annotationConfigId: $configId }
        ) {
          query {
            __typename
          }
        }
      }
    `);
  const [removeConfig] =
    useMutation<ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarRemoveConfigFromProjectMutation(
        $projectId: ID!
        $configId: ID!
      ) {
        removeAnnotationConfigFromProject(
          input: { projectId: $projectId, annotationConfigId: $configId }
        ) {
          query {
            __typename
          }
        }
      }
    `);
  const [createConfig] =
    useMutation<ConnectedDetailPanelAnnotationBarCreateConfigMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarCreateConfigMutation(
        $input: CreateAnnotationConfigInput!
      ) {
        createAnnotationConfig(input: $input) {
          annotationConfig {
            __typename
            ... on Node {
              id
            }
          }
        }
      }
    `);
  const [updateConfig] =
    useMutation<ConnectedDetailPanelAnnotationBarUpdateConfigMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarUpdateConfigMutation(
        $input: UpdateAnnotationConfigInput!
      ) {
        updateAnnotationConfig(input: $input) {
          annotationConfig {
            __typename
            ... on Node {
              id
            }
          }
        }
      }
    `);

  const onAddAnnotationConfigToProject = (configId: string) =>
    new Promise<AnnotationBarMutationResult>((resolve) => {
      addConfig({
        variables: { projectId, configId },
        onCompleted: () => {
          refresh();
          resolve({ success: true });
        },
        onError: (error) =>
          resolve({ success: false, error: getMutationError(error) }),
      });
    });
  const onRemoveAnnotationConfigFromProject = (configId: string) =>
    new Promise<AnnotationBarMutationResult>((resolve) => {
      removeConfig({
        variables: { projectId, configId },
        onCompleted: () => {
          refresh();
          resolve({ success: true });
        },
        onError: (error) =>
          resolve({ success: false, error: getMutationError(error) }),
      });
    });
  const onCreateAnnotationConfig = (config: AnnotationConfig) =>
    new Promise<AnnotationBarMutationResult>((resolve) => {
      createConfig({
        variables: {
          input: { annotationConfig: getAnnotationConfigInput(config) },
        },
        onCompleted: (response) => {
          const configId = response.createAnnotationConfig.annotationConfig.id;
          if (!configId) {
            resolve({
              success: false,
              error: "The annotation configuration was created without an ID.",
            });
            return;
          }
          addConfig({
            variables: { projectId, configId },
            onCompleted: () => {
              refresh();
              resolve({ success: true });
            },
            onError: (error) =>
              resolve({ success: false, error: getMutationError(error) }),
          });
        },
        onError: (error) =>
          resolve({ success: false, error: getMutationError(error) }),
      });
    });
  const onUpdateAnnotationConfig = (config: AnnotationConfig) =>
    new Promise<AnnotationBarMutationResult>((resolve) => {
      if (!config.id) {
        resolve({
          success: false,
          error: "The annotation configuration does not have an ID.",
        });
        return;
      }
      updateConfig({
        variables: {
          input: {
            id: config.id,
            annotationConfig: getAnnotationConfigInput(config),
          },
        },
        onCompleted: () => {
          refresh();
          resolve({ success: true });
        },
        onError: (error) =>
          resolve({ success: false, error: getMutationError(error) }),
      });
    });

  return {
    onAddAnnotationConfigToProject,
    onCreateAnnotationConfig,
    onRemoveAnnotationConfigFromProject,
    onUpdateAnnotationConfig,
  };
}

const spanDetailPanelAnnotationBarQuery = graphql`
  query ConnectedDetailPanelAnnotationBarSpanQuery($id: ID!) {
    allAnnotationConfigs: annotationConfigs {
      edges {
        node {
          ...ConnectedDetailPanelAnnotationBarConfigFields
        }
      }
    }
    span: node(id: $id) {
      __typename
      ... on Span {
        id
        project {
          id
          annotationConfigs {
            edges {
              node {
                ...ConnectedDetailPanelAnnotationBarConfigFields
              }
            }
          }
        }
        spanAnnotations {
          ...ConnectedDetailPanelAnnotationBarAnnotationFields
        }
      }
    }
  }
`;

export function useSpanDetailPanelAnnotationBarQuery(spanNodeId: string) {
  const [queryRef, loadQuery] =
    useQueryLoader<ConnectedDetailPanelAnnotationBarSpanQuery>(
      spanDetailPanelAnnotationBarQuery
    );
  const refresh = useCallback(() => {
    loadQuery({ id: spanNodeId }, { fetchPolicy: "store-and-network" });
  }, [loadQuery, spanNodeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { queryRef, refresh };
}

export function SpanDetailPanelAnnotationBar({
  queryRef,
  refresh,
  variant = "detail-header",
}: {
  queryRef: PreloadedQuery<ConnectedDetailPanelAnnotationBarSpanQuery>;
  refresh: () => void;
  variant?: DetailPanelAnnotationBarVariant;
}) {
  const data = usePreloadedQuery<ConnectedDetailPanelAnnotationBarSpanQuery>(
    spanDetailPanelAnnotationBarQuery,
    queryRef
  );
  if (data.span.__typename !== "Span") {
    return null;
  }
  return (
    <SpanDetailPanelAnnotationBarContent
      allAnnotationConfigs={data.allAnnotationConfigs.edges.map(({ node }) =>
        getAnnotationConfig(node)
      )}
      projectAnnotationConfigs={data.span.project.annotationConfigs.edges.map(
        ({ node }) => getAnnotationConfig(node)
      )}
      refresh={refresh}
      variant={variant}
      span={{
        id: data.span.id,
        annotations: getAnnotations(data.span.spanAnnotations),
        projectId: data.span.project.id,
      }}
    />
  );
}

function SpanDetailPanelAnnotationBarContent({
  allAnnotationConfigs,
  projectAnnotationConfigs,
  refresh,
  span,
  variant,
}: {
  allAnnotationConfigs: readonly AnnotationConfig[];
  projectAnnotationConfigs: readonly AnnotationConfig[];
  refresh: () => void;
  variant: DetailPanelAnnotationBarVariant;
  span: {
    annotations: Annotation[];
    id: string;
    projectId: string;
  };
}) {
  const configHandlers = useAnnotationConfigMutationHandlers({
    projectId: span.projectId,
    refresh,
  });
  const annotationHandlers = useAnnotationMutationHandlers({ refresh });
  const rows: AnnotationBarRow[] = [
    {
      id: `span-${span.id}`,
      kind: "target",
      target: {
        id: span.id,
        kind: "span",
        annotations: span.annotations,
      },
    },
  ];
  return (
    <DetailPanelAnnotationBar
      allAnnotationConfigs={allAnnotationConfigs}
      projectAnnotationConfigs={projectAnnotationConfigs}
      rows={rows}
      variant={variant}
      {...configHandlers}
      {...annotationHandlers}
    />
  );
}

/** Fetches and renders a span annotation affordance for the requested variant. */
export function ConnectedSpanDetailPanelAnnotationBar({
  spanNodeId,
  variant = "detail-header",
}: {
  spanNodeId: string;
  variant?: DetailPanelAnnotationBarVariant;
}) {
  const { queryRef, refresh } =
    useSpanDetailPanelAnnotationBarQuery(spanNodeId);
  if (queryRef == null) {
    return null;
  }
  return (
    <SpanDetailPanelAnnotationBar
      queryRef={queryRef}
      refresh={refresh}
      variant={variant}
    />
  );
}

/** Loads span annotations only after the row action is opened. */
export function SpanDetailPanelAnnotationButton({
  spanNodeId,
}: {
  spanNodeId: string;
}) {
  return (
    <DetailPanelAnnotationButton targetKind="span">
      <ConnectedSpanDetailPanelAnnotationBar
        spanNodeId={spanNodeId}
        variant="button-menu"
      />
    </DetailPanelAnnotationButton>
  );
}

export function useAnnotationMutationHandlers({
  refresh,
}: {
  refresh: () => void;
}): Pick<
  ComponentProps<typeof DetailPanelAnnotationBar>,
  "onCreateAnnotation" | "onDeleteAnnotation" | "onUpdateAnnotation"
> {
  const [createSpanAnnotation] =
    useMutation<ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarCreateSpanAnnotationMutation(
        $input: CreateSpanAnnotationInput!
      ) {
        createSpanAnnotations(input: [$input]) {
          spanAnnotations {
            id
          }
        }
      }
    `);
  const [updateSpanAnnotation] =
    useMutation<ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation(
        $input: PatchAnnotationInput!
      ) {
        patchSpanAnnotations(input: [$input]) {
          spanAnnotations {
            id
          }
        }
      }
    `);
  const [deleteSpanAnnotation] =
    useMutation<ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarDeleteSpanAnnotationMutation(
        $annotationId: ID!
      ) {
        deleteSpanAnnotations(input: { annotationIds: [$annotationId] }) {
          query {
            __typename
          }
        }
      }
    `);
  const [createTraceAnnotation] =
    useMutation<ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarCreateTraceAnnotationMutation(
        $input: CreateTraceAnnotationInput!
      ) {
        createTraceAnnotations(input: [$input]) {
          traceAnnotations {
            id
          }
        }
      }
    `);
  const [updateTraceAnnotation] =
    useMutation<ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation(
        $input: PatchAnnotationInput!
      ) {
        patchTraceAnnotations(input: [$input]) {
          traceAnnotations {
            id
          }
        }
      }
    `);
  const [deleteTraceAnnotation] =
    useMutation<ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarDeleteTraceAnnotationMutation(
        $annotationId: ID!
      ) {
        deleteTraceAnnotations(input: { annotationIds: [$annotationId] }) {
          query {
            __typename
          }
        }
      }
    `);
  const [createSessionAnnotation] =
    useMutation<ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarCreateSessionAnnotationMutation(
        $input: CreateProjectSessionAnnotationInput!
      ) {
        createProjectSessionAnnotations(input: $input) {
          projectSessionAnnotation {
            id
          }
        }
      }
    `);
  const [updateSessionAnnotation] =
    useMutation<ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation(
        $input: UpdateAnnotationInput!
      ) {
        updateProjectSessionAnnotations(input: $input) {
          query {
            __typename
          }
        }
      }
    `);
  const [deleteSessionAnnotation] =
    useMutation<ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation>(graphql`
      mutation ConnectedDetailPanelAnnotationBarDeleteSessionAnnotationMutation(
        $annotationId: ID!
      ) {
        deleteProjectSessionAnnotation(id: $annotationId) {
          query {
            __typename
          }
        }
      }
    `);

  const onCreateAnnotation = ({
    annotationName,
    target,
    value,
  }: {
    annotationName: string;
    target: AnnotationBarTarget;
    value: AnnotationValueDraft;
  }) => {
    const shared = {
      name: annotationName,
      label: value.label,
      score: value.score,
      explanation: value.explanation || null,
      annotatorKind: value.annotatorKind,
      source: value.source,
      metadata: value.metadata,
    };
    return new Promise<AnnotationBarCreateResult>((resolve) => {
      const resolveSuccess = (annotationId: string | undefined) => {
        if (!annotationId) {
          resolve({
            success: false,
            error: "The annotation was created without an ID.",
          });
          return;
        }
        refresh();
        resolve({
          success: true,
          annotation: { id: annotationId, ...shared },
        });
      };
      const onError = (error: Error) =>
        resolve({ success: false, error: getMutationError(error) } as const);
      switch (target.kind) {
        case "span":
          createSpanAnnotation({
            variables: { input: { ...shared, spanId: target.id } },
            onCompleted: (response) =>
              resolveSuccess(
                response.createSpanAnnotations.spanAnnotations[0]?.id
              ),
            onError,
          });
          break;
        case "trace":
          createTraceAnnotation({
            variables: { input: { ...shared, traceId: target.id } },
            onCompleted: (response) =>
              resolveSuccess(
                response.createTraceAnnotations.traceAnnotations[0]?.id
              ),
            onError,
          });
          break;
        case "session":
          createSessionAnnotation({
            variables: {
              input: { ...shared, projectSessionId: target.id },
            },
            onCompleted: (response) =>
              resolveSuccess(
                response.createProjectSessionAnnotations
                  .projectSessionAnnotation.id
              ),
            onError,
          });
          break;
      }
    });
  };
  const onUpdateAnnotation = ({
    annotation,
    target,
    value,
  }: {
    annotation: Annotation;
    target: AnnotationBarTarget;
    value: AnnotationValueDraft;
  }) => {
    const annotationId = annotation.id;
    if (!annotationId) {
      return Promise.resolve<AnnotationBarMutationResult>({
        success: false,
        error: "The annotation does not have an ID.",
      });
    }
    return new Promise<AnnotationBarMutationResult>((resolve) => {
      const callbacks = {
        onCompleted: () => {
          refresh();
          resolve({ success: true } as const);
        },
        onError: (error: Error) =>
          resolve({ success: false, error: getMutationError(error) } as const),
      };
      const input = {
        annotationId,
        name: annotation.name,
        label: value.label,
        score: value.score,
        explanation: value.explanation || null,
        annotatorKind: value.annotatorKind,
        source: value.source,
        metadata: value.metadata,
      };
      switch (target.kind) {
        case "span":
          updateSpanAnnotation({ variables: { input }, ...callbacks });
          break;
        case "trace":
          updateTraceAnnotation({ variables: { input }, ...callbacks });
          break;
        case "session":
          updateSessionAnnotation({
            variables: {
              input: {
                id: annotationId,
                name: annotation.name,
                label: value.label,
                score: value.score,
                explanation: value.explanation || null,
                annotatorKind: value.annotatorKind,
                source: value.source,
                metadata: value.metadata,
              },
            },
            ...callbacks,
          });
          break;
      }
    });
  };
  const onDeleteAnnotation = ({
    annotation,
    target,
  }: {
    annotation: Annotation;
    target: AnnotationBarTarget;
  }) => {
    const annotationId = annotation.id;
    if (!annotationId) {
      return Promise.resolve<AnnotationBarMutationResult>({
        success: false,
        error: "The annotation does not have an ID.",
      });
    }
    return new Promise<AnnotationBarMutationResult>((resolve) => {
      const callbacks = {
        onCompleted: () => {
          refresh();
          resolve({ success: true } as const);
        },
        onError: (error: Error) =>
          resolve({ success: false, error: getMutationError(error) } as const),
      };
      const variables = { annotationId };
      switch (target.kind) {
        case "span":
          deleteSpanAnnotation({ variables, ...callbacks });
          break;
        case "trace":
          deleteTraceAnnotation({ variables, ...callbacks });
          break;
        case "session":
          deleteSessionAnnotation({ variables, ...callbacks });
          break;
      }
    });
  };
  return { onCreateAnnotation, onUpdateAnnotation, onDeleteAnnotation };
}

export function TraceDetailPanelAnnotationBar({
  traceNodeId,
  variant = "detail-header",
}: {
  traceNodeId: string;
  variant?: DetailPanelAnnotationBarVariant;
}) {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<ConnectedDetailPanelAnnotationBarTraceQuery>(
    graphql`
      query ConnectedDetailPanelAnnotationBarTraceQuery($id: ID!) {
        allAnnotationConfigs: annotationConfigs {
          edges {
            node {
              ...ConnectedDetailPanelAnnotationBarConfigFields
            }
          }
        }
        trace: node(id: $id) {
          __typename
          ... on Trace {
            id
            project {
              id
              annotationConfigs {
                edges {
                  node {
                    ...ConnectedDetailPanelAnnotationBarConfigFields
                  }
                }
              }
            }
            traceAnnotations {
              ...ConnectedDetailPanelAnnotationBarTraceAnnotationFields
            }
          }
        }
      }
    `,
    { id: traceNodeId },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  if (data.trace.__typename !== "Trace") {
    return null;
  }
  const refresh = () => setFetchKey((currentFetchKey) => currentFetchKey + 1);
  return (
    <TraceDetailPanelAnnotationBarContent
      allAnnotationConfigs={data.allAnnotationConfigs.edges.map(({ node }) =>
        getAnnotationConfig(node)
      )}
      projectAnnotationConfigs={data.trace.project.annotationConfigs.edges.map(
        ({ node }) => getAnnotationConfig(node)
      )}
      projectId={data.trace.project.id}
      refresh={refresh}
      variant={variant}
      trace={{
        id: data.trace.id,
        annotations: getTraceAnnotations(data.trace.traceAnnotations),
      }}
    />
  );
}

/** Loads trace annotations only after the row action is opened. */
export function TraceDetailPanelAnnotationButton({
  traceNodeId,
}: {
  traceNodeId: string;
}) {
  return (
    <DetailPanelAnnotationButton targetKind="trace">
      <TraceDetailPanelAnnotationBar
        traceNodeId={traceNodeId}
        variant="button-menu"
      />
    </DetailPanelAnnotationButton>
  );
}

function TraceDetailPanelAnnotationBarContent({
  allAnnotationConfigs,
  projectAnnotationConfigs,
  projectId,
  refresh,
  trace,
  variant,
}: {
  allAnnotationConfigs: readonly AnnotationConfig[];
  projectAnnotationConfigs: readonly AnnotationConfig[];
  projectId: string;
  refresh: () => void;
  variant: DetailPanelAnnotationBarVariant;
  trace: { annotations: Annotation[]; id: string };
}) {
  const configHandlers = useAnnotationConfigMutationHandlers({
    projectId,
    refresh,
  });
  const annotationHandlers = useAnnotationMutationHandlers({ refresh });
  const rows: AnnotationBarRow[] = [
    {
      id: `trace-${trace.id}`,
      kind: "target",
      target: {
        id: trace.id,
        kind: "trace",
        annotations: trace.annotations,
      },
    },
  ];
  return (
    <DetailPanelAnnotationBar
      allAnnotationConfigs={allAnnotationConfigs}
      projectAnnotationConfigs={projectAnnotationConfigs}
      rows={rows}
      variant={variant}
      {...configHandlers}
      {...annotationHandlers}
    />
  );
}

export function SessionDetailPanelAnnotationBar({
  sessionNodeId,
  variant = "detail-header",
}: {
  sessionNodeId: string;
  variant?: DetailPanelAnnotationBarVariant;
}) {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<ConnectedDetailPanelAnnotationBarSessionQuery>(
    graphql`
      query ConnectedDetailPanelAnnotationBarSessionQuery($id: ID!) {
        allAnnotationConfigs: annotationConfigs {
          edges {
            node {
              ...ConnectedDetailPanelAnnotationBarConfigFields
            }
          }
        }
        session: node(id: $id) {
          __typename
          ... on ProjectSession {
            id
            project {
              id
              annotationConfigs {
                edges {
                  node {
                    ...ConnectedDetailPanelAnnotationBarConfigFields
                  }
                }
              }
            }
            sessionAnnotations {
              ...ConnectedDetailPanelAnnotationBarAnnotationFields
            }
          }
        }
      }
    `,
    { id: sessionNodeId },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  if (data.session.__typename !== "ProjectSession") {
    return null;
  }
  const refresh = () => setFetchKey((currentFetchKey) => currentFetchKey + 1);
  return (
    <SessionDetailPanelAnnotationBarContent
      allAnnotationConfigs={data.allAnnotationConfigs.edges.map(({ node }) =>
        getAnnotationConfig(node)
      )}
      projectAnnotationConfigs={data.session.project.annotationConfigs.edges.map(
        ({ node }) => getAnnotationConfig(node)
      )}
      projectId={data.session.project.id}
      refresh={refresh}
      variant={variant}
      session={{
        id: data.session.id,
        annotations: getAnnotations(data.session.sessionAnnotations),
      }}
    />
  );
}

/** Loads session annotations only after the row action is opened. */
export function SessionDetailPanelAnnotationButton({
  sessionNodeId,
}: {
  sessionNodeId: string;
}) {
  return (
    <DetailPanelAnnotationButton targetKind="session">
      <SessionDetailPanelAnnotationBar
        sessionNodeId={sessionNodeId}
        variant="button-menu"
      />
    </DetailPanelAnnotationButton>
  );
}

function SessionDetailPanelAnnotationBarContent({
  allAnnotationConfigs,
  projectAnnotationConfigs,
  projectId,
  refresh,
  session,
  variant,
}: {
  allAnnotationConfigs: readonly AnnotationConfig[];
  projectAnnotationConfigs: readonly AnnotationConfig[];
  projectId: string;
  refresh: () => void;
  session: { annotations: Annotation[]; id: string };
  variant: DetailPanelAnnotationBarVariant;
}) {
  const configHandlers = useAnnotationConfigMutationHandlers({
    projectId,
    refresh,
  });
  const annotationHandlers = useAnnotationMutationHandlers({ refresh });
  const rows: AnnotationBarRow[] = [
    {
      id: `session-${session.id}`,
      kind: "target",
      target: {
        id: session.id,
        kind: "session",
        annotations: session.annotations,
      },
    },
  ];
  return (
    <DetailPanelAnnotationBar
      allAnnotationConfigs={allAnnotationConfigs}
      projectAnnotationConfigs={projectAnnotationConfigs}
      rows={rows}
      variant={variant}
      {...configHandlers}
      {...annotationHandlers}
    />
  );
}

void annotationConfigFields;
void annotationFields;
void traceAnnotationFields;
