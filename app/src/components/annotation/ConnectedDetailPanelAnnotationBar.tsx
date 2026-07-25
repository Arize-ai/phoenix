import type { ComponentProps } from "react";
import { useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
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
import type { ConnectedDetailPanelAnnotationBarUpdateConfigMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarUpdateConfigMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarUpdateSessionAnnotationMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarUpdateSpanAnnotationMutation.graphql";
import type { ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation } from "@phoenix/components/annotation/__generated__/ConnectedDetailPanelAnnotationBarUpdateTraceAnnotationMutation.graphql";
import {
  type AnnotationBarMutationResult,
  type AnnotationBarRow,
  type AnnotationBarTarget,
  type AnnotationValueDraft,
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
    annotatorKind
    createdAt
    user {
      id
      username
      profilePictureUrl
    }
  }
`;

const traceAnnotationFields = graphql`
  fragment ConnectedDetailPanelAnnotationBarTraceAnnotationFields on TraceAnnotation
  @inline {
    id
    name
    label
    score
    explanation
    annotatorKind
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

function getAnnotations(
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
      annotatorKind: annotation.annotatorKind,
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
      annotatorKind: annotation.annotatorKind,
      createdAt: annotation.createdAt,
      user: annotation.user,
    };
  });
}

function getAnnotationConfig(
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

function useAnnotationConfigMutationHandlers({
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

export function SpanDetailPanelAnnotationBar({
  spanNodeId,
}: {
  spanNodeId: string;
}) {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<ConnectedDetailPanelAnnotationBarSpanQuery>(
    graphql`
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
            parentId
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
            trace {
              id
              traceAnnotations {
                ...ConnectedDetailPanelAnnotationBarTraceAnnotationFields
              }
              session {
                id
                sessionAnnotations {
                  ...ConnectedDetailPanelAnnotationBarAnnotationFields
                }
              }
            }
          }
        }
      }
    `,
    { id: spanNodeId },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  if (data.span.__typename !== "Span") {
    return null;
  }
  const refresh = () => setFetchKey((currentFetchKey) => currentFetchKey + 1);
  return (
    <SpanDetailPanelAnnotationBarContent
      allAnnotationConfigs={data.allAnnotationConfigs.edges.map(({ node }) =>
        getAnnotationConfig(node)
      )}
      projectAnnotationConfigs={data.span.project.annotationConfigs.edges.map(
        ({ node }) => getAnnotationConfig(node)
      )}
      refresh={refresh}
      span={{
        id: data.span.id,
        parentId: data.span.parentId,
        annotations: getAnnotations(data.span.spanAnnotations),
        trace: {
          id: data.span.trace.id,
          annotations: getTraceAnnotations(data.span.trace.traceAnnotations),
          session: data.span.trace.session
            ? {
                id: data.span.trace.session.id,
                annotations: getAnnotations(
                  data.span.trace.session.sessionAnnotations
                ),
              }
            : null,
        },
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
}: {
  allAnnotationConfigs: readonly AnnotationConfig[];
  projectAnnotationConfigs: readonly AnnotationConfig[];
  refresh: () => void;
  span: {
    annotations: Annotation[];
    id: string;
    parentId: string | null;
    projectId: string;
    trace: {
      annotations: Annotation[];
      id: string;
      session: { annotations: Annotation[]; id: string } | null;
    };
  };
}) {
  const configHandlers = useAnnotationConfigMutationHandlers({
    projectId: span.projectId,
    refresh,
  });
  const annotationHandlers = useAnnotationMutationHandlers({ refresh });
  const rows: AnnotationBarRow[] = [];
  if (span.trace.session) {
    rows.push({
      id: `session-${span.trace.session.id}`,
      kind: "target",
      target: {
        id: span.trace.session.id,
        kind: "session",
        label: "Session",
        annotations: span.trace.session.annotations,
      },
    });
  }
  rows.push({
    id: `trace-${span.trace.id}`,
    kind: "target",
    target: {
      id: span.trace.id,
      kind: "trace",
      label: "Trace",
      annotations: span.trace.annotations,
    },
  });
  if (span.parentId) {
    rows.push({
      id: `additional-spans-${span.id}`,
      kind: "message",
      text: "Additional spans",
    });
  }
  rows.push({
    id: `span-${span.id}`,
    kind: "target",
    target: {
      id: span.id,
      kind: "span",
      label: "This span",
      annotations: span.annotations,
    },
  });
  return (
    <DetailPanelAnnotationBar
      allAnnotationConfigs={allAnnotationConfigs}
      projectAnnotationConfigs={projectAnnotationConfigs}
      rows={rows}
      {...configHandlers}
      {...annotationHandlers}
    />
  );
}

function useAnnotationMutationHandlers({
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
          query {
            __typename
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
    config,
    target,
    value,
  }: {
    config: AnnotationConfig;
    target: AnnotationBarTarget;
    value: AnnotationValueDraft;
  }) => {
    const shared = {
      name: config.name,
      label: value.label,
      score: value.score,
      explanation: value.explanation || null,
      annotatorKind: "HUMAN" as const,
      source: "APP" as const,
      metadata: {},
    };
    return new Promise<AnnotationBarMutationResult>((resolve) => {
      const callbacks = {
        onCompleted: () => {
          refresh();
          resolve({ success: true } as const);
        },
        onError: (error: Error) =>
          resolve({ success: false, error: getMutationError(error) } as const),
      };
      switch (target.kind) {
        case "span":
          createSpanAnnotation({
            variables: { input: { ...shared, spanId: target.id } },
            ...callbacks,
          });
          break;
        case "trace":
          createTraceAnnotation({
            variables: { input: { ...shared, traceId: target.id } },
            ...callbacks,
          });
          break;
        case "session":
          createSessionAnnotation({
            variables: {
              input: { ...shared, projectSessionId: target.id },
            },
            ...callbacks,
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
        annotatorKind: "HUMAN" as const,
        source: "APP" as const,
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
                annotatorKind: "HUMAN",
                source: "APP",
                metadata: {},
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

export function SessionDetailPanelAnnotationBar({
  sessionNodeId,
}: {
  sessionNodeId: string;
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
      session={{
        id: data.session.id,
        annotations: getAnnotations(data.session.sessionAnnotations),
      }}
    />
  );
}

function SessionDetailPanelAnnotationBarContent({
  allAnnotationConfigs,
  projectAnnotationConfigs,
  projectId,
  refresh,
  session,
}: {
  allAnnotationConfigs: readonly AnnotationConfig[];
  projectAnnotationConfigs: readonly AnnotationConfig[];
  projectId: string;
  refresh: () => void;
  session: { annotations: Annotation[]; id: string };
}) {
  const configHandlers = useAnnotationConfigMutationHandlers({
    projectId,
    refresh,
  });
  const annotationHandlers = useAnnotationMutationHandlers({ refresh });
  return (
    <DetailPanelAnnotationBar
      allAnnotationConfigs={allAnnotationConfigs}
      projectAnnotationConfigs={projectAnnotationConfigs}
      rows={[
        {
          id: `session-${session.id}`,
          kind: "target",
          target: {
            id: session.id,
            kind: "session",
            label: "This session",
            annotations: session.annotations,
          },
        },
      ]}
      {...configHandlers}
      {...annotationHandlers}
    />
  );
}

void annotationConfigFields;
void annotationFields;
void traceAnnotationFields;
