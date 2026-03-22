import { isString } from "lodash";
import { startTransition, useCallback, useMemo } from "react";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";

import {
  Autocomplete,
  Input,
  Menu,
  MenuEmpty,
  MenuHeader,
  MenuItem,
  SearchField,
  Text,
  Token,
  useFilter,
} from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation";
import { SearchIcon } from "@phoenix/components/core/field";
import type { AnnotationConfigListAssociateAnnotationConfigWithProjectMutation } from "@phoenix/components/trace/__generated__/AnnotationConfigListAssociateAnnotationConfigWithProjectMutation.graphql";
import type { AnnotationConfigListProjectAnnotationConfigFragment$key } from "@phoenix/components/trace/__generated__/AnnotationConfigListProjectAnnotationConfigFragment.graphql";
import type { AnnotationConfigListQuery } from "@phoenix/components/trace/__generated__/AnnotationConfigListQuery.graphql";
import type { AnnotationConfigListRemoveAnnotationConfigFromProjectMutation } from "@phoenix/components/trace/__generated__/AnnotationConfigListRemoveAnnotationConfigFromProjectMutation.graphql";
import { useViewer } from "@phoenix/contexts/ViewerContext";

export function AnnotationConfigList(props: {
  projectId: string;
  spanId: string;
  refetchKey?: number;
}) {
  const { projectId, spanId, refetchKey = 0 } = props;
  const { contains } = useFilter({ sensitivity: "base" });
  const { viewer } = useViewer();
  const viewerId = viewer?.id;
  const data = useLazyLoadQuery<AnnotationConfigListQuery>(
    graphql`
      query AnnotationConfigListQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            ...AnnotationConfigListProjectAnnotationConfigFragment
          }
        }
        allAnnotationConfigs: annotationConfigs {
          edges {
            node {
              ... on Node {
                id
              }
              ... on AnnotationConfigBase {
                name
                description
                annotationType
              }
              ... on CategoricalAnnotationConfig {
                values {
                  label
                  score
                }
              }
              ... on ContinuousAnnotationConfig {
                lowerBound
                upperBound
              }
            }
          }
        }
      }
    `,
    { projectId },
    { fetchKey: refetchKey, fetchPolicy: "store-and-network" }
  );

  const projectAnnotationData =
    useFragment<AnnotationConfigListProjectAnnotationConfigFragment$key>(
      graphql`
        fragment AnnotationConfigListProjectAnnotationConfigFragment on Project {
          annotationConfigs {
            edges {
              node {
                ... on Node {
                  id
                }
                ... on AnnotationConfigBase {
                  name
                  annotationType
                  description
                }
                ... on CategoricalAnnotationConfig {
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
                  name
                }
              }
            }
          }
        }
      `,
      data.project
    );
  // mutation to associate an annotation config with a project
  const [addAnnotationConfigToProjectMutation] =
    useMutation<AnnotationConfigListAssociateAnnotationConfigWithProjectMutation>(
      graphql`
        mutation AnnotationConfigListAssociateAnnotationConfigWithProjectMutation(
          $projectId: ID!
          $annotationConfigId: ID!
          $spanId: ID!
          $filterUserIds: [ID!]
        ) {
          addAnnotationConfigToProject(
            input: { projectId: $projectId, annotationConfigId: $annotationConfigId }
          ) {
            query {
              projectNode: node(id: $projectId) {
                ... on Project {
                  id
                  ...AnnotationConfigListProjectAnnotationConfigFragment
                }
              }
              node(id: $spanId) {
                ... on Span {
                  id
                  ...SpanAnnotationsEditor_spanAnnotations
                    @arguments(filterUserIds: $filterUserIds)
                }
              }
            }
          }
        }
      `
    );
  // mutation to remove an annotation config from a project
  const [removeAnnotationConfigFromProjectMutation] =
    useMutation<AnnotationConfigListRemoveAnnotationConfigFromProjectMutation>(
      graphql`
        mutation AnnotationConfigListRemoveAnnotationConfigFromProjectMutation(
          $projectId: ID!
          $annotationConfigId: ID!
          $spanId: ID!
          $filterUserIds: [ID!]
        ) {
          removeAnnotationConfigFromProject(
            input: { projectId: $projectId, annotationConfigId: $annotationConfigId }
          ) {
            query {
              projectNode: node(id: $projectId) {
                ... on Project {
                  id
                  ...AnnotationConfigListProjectAnnotationConfigFragment
                }
              }
              node(id: $spanId) {
                ... on Span {
                  id
                  ...SpanAnnotationsEditor_spanAnnotations
                    @arguments(filterUserIds: $filterUserIds)
                }
              }
            }
          }
        }
      `
    );

  const addAnnotationConfigToProject = useCallback(
    (annotationConfigId: string) => {
      startTransition(() => {
        addAnnotationConfigToProjectMutation({
          variables: {
            projectId,
            annotationConfigId,
            spanId,
            filterUserIds: viewerId ? [viewerId] : null,
          },
        });
      });
    },
    [projectId, addAnnotationConfigToProjectMutation, spanId, viewerId]
  );

  const removeAnnotationConfigFromProject = useCallback(
    (annotationConfigId: string) => {
      removeAnnotationConfigFromProjectMutation({
        variables: {
          projectId,
          annotationConfigId,
          spanId,
          filterUserIds: viewerId ? [viewerId] : null,
        },
      });
    },
    [projectId, removeAnnotationConfigFromProjectMutation, spanId, viewerId]
  );

  const allAnnotationConfigs = useMemo(
    () => data.allAnnotationConfigs.edges.map((edge) => edge.node),
    [data]
  );
  const projectAnnotationConfigs = useMemo(
    () => projectAnnotationData.annotationConfigs?.edges || [],
    [projectAnnotationData]
  );
  const annotationConfigIdsInProject: Set<string> = useMemo(() => {
    const configIds = projectAnnotationConfigs
      .map((config) => config.node.id)
      .filter(isString);
    return new Set(configIds);
  }, [projectAnnotationConfigs]);

  const handleSelectionChange = useCallback(
    (keys: "all" | Set<React.Key>) => {
      if (keys === "all") {
        return;
      }
      const newSelectedIds = new Set(Array.from(keys) as string[]);
      for (const configId of newSelectedIds) {
        if (!annotationConfigIdsInProject.has(configId)) {
          addAnnotationConfigToProject(configId);
        }
      }
      for (const configId of annotationConfigIdsInProject) {
        if (!newSelectedIds.has(configId)) {
          removeAnnotationConfigFromProject(configId);
        }
      }
    },
    [
      addAnnotationConfigToProject,
      removeAnnotationConfigFromProject,
      annotationConfigIdsInProject,
    ]
  );

  return (
    <Autocomplete filter={contains}>
      <MenuHeader>
        <SearchField
          aria-label="Search annotation configs"
          variant="quiet"
          autoFocus
        >
          <SearchIcon />
          <Input placeholder="Search annotation configs" />
        </SearchField>
      </MenuHeader>
      <Menu
        aria-label="Annotation Configs"
        items={allAnnotationConfigs}
        selectionMode="multiple"
        selectedKeys={annotationConfigIdsInProject}
        onSelectionChange={handleSelectionChange}
        renderEmptyState={() => (
          <MenuEmpty>No annotation configs found.</MenuEmpty>
        )}
      >
        {({ id, name, annotationType }) => (
          <MenuItem
            id={id}
            textValue={name ?? undefined}
            leadingContent={
              <AnnotationColorSwatch annotationName={name || ""} />
            }
            trailingContent={
              <Token size="S">{annotationType?.toLocaleLowerCase()}</Token>
            }
          >
            <Text>{name}</Text>
          </MenuItem>
        )}
      </Menu>
    </Autocomplete>
  );
}
