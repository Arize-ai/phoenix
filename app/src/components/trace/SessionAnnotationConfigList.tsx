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
import type { SessionAnnotationConfigListAssociateAnnotationConfigWithProjectMutation } from "@phoenix/components/trace/__generated__/SessionAnnotationConfigListAssociateAnnotationConfigWithProjectMutation.graphql";
import type { SessionAnnotationConfigListProjectAnnotationConfigFragment$key } from "@phoenix/components/trace/__generated__/SessionAnnotationConfigListProjectAnnotationConfigFragment.graphql";
import type { SessionAnnotationConfigListQuery } from "@phoenix/components/trace/__generated__/SessionAnnotationConfigListQuery.graphql";
import type { SessionAnnotationConfigListRemoveAnnotationConfigFromProjectMutation } from "@phoenix/components/trace/__generated__/SessionAnnotationConfigListRemoveAnnotationConfigFromProjectMutation.graphql";

export function SessionAnnotationConfigList(props: {
  projectId: string;
  refetchKey?: number;
}) {
  const { projectId, refetchKey = 0 } = props;
  const { contains } = useFilter({ sensitivity: "base" });
  const data = useLazyLoadQuery<SessionAnnotationConfigListQuery>(
    graphql`
      query SessionAnnotationConfigListQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            ...SessionAnnotationConfigListProjectAnnotationConfigFragment
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
    useFragment<SessionAnnotationConfigListProjectAnnotationConfigFragment$key>(
      graphql`
        fragment SessionAnnotationConfigListProjectAnnotationConfigFragment on Project {
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
                  optimizationDirection
                  threshold
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
    useMutation<SessionAnnotationConfigListAssociateAnnotationConfigWithProjectMutation>(
      graphql`
        mutation SessionAnnotationConfigListAssociateAnnotationConfigWithProjectMutation(
          $projectId: ID!
          $annotationConfigId: ID!
        ) {
          addAnnotationConfigToProject(
            input: {
              projectId: $projectId
              annotationConfigId: $annotationConfigId
            }
          ) {
            query {
              projectNode: node(id: $projectId) {
                ... on Project {
                  id
                  ...SessionAnnotationConfigListProjectAnnotationConfigFragment
                }
              }
            }
          }
        }
      `
    );
  // mutation to remove an annotation config from a project
  const [removeAnnotationConfigFromProjectMutation] =
    useMutation<SessionAnnotationConfigListRemoveAnnotationConfigFromProjectMutation>(
      graphql`
        mutation SessionAnnotationConfigListRemoveAnnotationConfigFromProjectMutation(
          $projectId: ID!
          $annotationConfigId: ID!
        ) {
          removeAnnotationConfigFromProject(
            input: {
              projectId: $projectId
              annotationConfigId: $annotationConfigId
            }
          ) {
            query {
              projectNode: node(id: $projectId) {
                ... on Project {
                  id
                  ...SessionAnnotationConfigListProjectAnnotationConfigFragment
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
          },
        });
      });
    },
    [projectId, addAnnotationConfigToProjectMutation]
  );

  const removeAnnotationConfigFromProject = useCallback(
    (annotationConfigId: string) => {
      removeAnnotationConfigFromProjectMutation({
        variables: {
          projectId,
          annotationConfigId,
        },
      });
    },
    [projectId, removeAnnotationConfigFromProjectMutation]
  );

  const allAnnotationConfigs = useMemo(
    () => data.allAnnotationConfigs.edges.map((edge) => edge.node),
    [data.allAnnotationConfigs.edges]
  );
  const projectAnnotationConfigs = useMemo(
    () => projectAnnotationData.annotationConfigs?.edges || [],
    [projectAnnotationData.annotationConfigs?.edges]
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
