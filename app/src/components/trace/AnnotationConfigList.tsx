import { startTransition, useCallback, useMemo, useState } from "react";
import { FocusScope } from "react-aria";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import { isString } from "lodash";
import { css } from "@emotion/react";

import {
  DebouncedSearch,
  Flex,
  Heading,
  Icon,
  Icons,
  ListBox,
  ListBoxItem,
  Text,
  Token,
  View,
} from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation";
import { AnnotationConfigListAssociateAnnotationConfigWithProjectMutation } from "@phoenix/components/trace/__generated__/AnnotationConfigListAssociateAnnotationConfigWithProjectMutation.graphql";
import { AnnotationConfigListProjectAnnotationConfigFragment$key } from "@phoenix/components/trace/__generated__/AnnotationConfigListProjectAnnotationConfigFragment.graphql";
import { AnnotationConfigListQuery } from "@phoenix/components/trace/__generated__/AnnotationConfigListQuery.graphql";
import { AnnotationConfigListRemoveAnnotationConfigFromProjectMutation } from "@phoenix/components/trace/__generated__/AnnotationConfigListRemoveAnnotationConfigFromProjectMutation.graphql";
import { useViewer } from "@phoenix/contexts/ViewerContext";

const annotationListBoxCSS = css`
  height: 300px;
  width: 320px;
  overflow-y: auto;
`;

export function AnnotationConfigList(props: {
  projectId: string;
  spanId: string;
  refetchKey?: number;
}) {
  const { projectId, spanId, refetchKey = 0 } = props;
  const [filter, setFilter] = useState<string>("");
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
            input: {
              projectId: $projectId
              annotationConfigId: $annotationConfigId
            }
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
            input: {
              projectId: $projectId
              annotationConfigId: $annotationConfigId
            }
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

  const allAnnotationConfigs = data.allAnnotationConfigs.edges;
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
  const filteredAnnotationConfigs = useMemo(() => {
    return allAnnotationConfigs.filter((config) =>
      config.node.name?.toLowerCase().includes(filter.toLowerCase())
    );
  }, [allAnnotationConfigs, filter]);
  const updateSelectedAnnotationConfigIds = useCallback(
    (selectedAnnotationConfigIds: Set<string>) => {
      filteredAnnotationConfigs.forEach((config) => {
        if (!config.node.id) {
          return;
        }
        if (
          selectedAnnotationConfigIds.has(config.node.id) &&
          !annotationConfigIdsInProject.has(config.node.id)
        ) {
          addAnnotationConfigToProject(config.node.id);
        } else if (
          !selectedAnnotationConfigIds.has(config.node.id) &&
          annotationConfigIdsInProject.has(config.node.id)
        ) {
          removeAnnotationConfigFromProject(config.node.id);
        }
      });
    },
    [
      filteredAnnotationConfigs,
      addAnnotationConfigToProject,
      removeAnnotationConfigFromProject,
      annotationConfigIdsInProject,
    ]
  );
  return (
    <FocusScope autoFocus contain>
      <View padding="size-100" minWidth={300}>
        <Flex direction="column" gap="size-100">
          <Flex direction="column" gap="size-100">
            <Heading level={4} weight="heavy">
              Add Annotations
            </Heading>
            <DebouncedSearch
              aria-label="Search annotation configs"
              onChange={setFilter}
              placeholder="Search annotation configs"
            />
          </Flex>
          <ListBox
            css={annotationListBoxCSS}
            selectionMode="multiple"
            selectionBehavior="toggle"
            aria-label="Annotation Configs"
            selectedKeys={annotationConfigIdsInProject}
            renderEmptyState={() => (
              <View width="100%" height="100%" paddingBottom="size-100">
                <Flex
                  direction="column"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text
                    color="text-700"
                    style={{
                      whiteSpace: "pre-wrap",
                      textAlign: "center",
                      padding: 0,
                    }}
                  >
                    {filter
                      ? `No annotation configs found for "${filter}".`
                      : "No annotation configs found."}
                  </Text>
                </Flex>
              </View>
            )}
            onSelectionChange={(keys) => {
              const keysArray = Array.from(keys) as string[];
              updateSelectedAnnotationConfigIds(new Set(keysArray));
            }}
          >
            {filteredAnnotationConfigs.map((config) => (
              <ListBoxItem
                key={config.node.id}
                id={config.node.id}
                textValue={config.node.name}
              >
                {({ isSelected }) => (
                  <Flex
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <AnnotationColorSwatch
                        annotationName={config.node.name || ""}
                      />
                      <Text>{config.node.name}</Text>
                      <Token size="S">
                        {config.node.annotationType?.toLocaleLowerCase()}
                      </Token>
                    </Flex>
                    {isSelected ? (
                      <Icon svg={<Icons.CheckmarkOutline />} />
                    ) : null}
                  </Flex>
                )}
              </ListBoxItem>
            ))}
          </ListBox>
        </Flex>
      </View>
    </FocusScope>
  );
}
