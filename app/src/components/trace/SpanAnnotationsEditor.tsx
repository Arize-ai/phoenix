import React, {
  startTransition,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { FocusManagerOptions, FocusScope } from "react-aria";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import { css } from "@emotion/react";

import {
  Autocomplete,
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Modal,
  ModalOverlay,
  Popover,
  PopoverArrow,
  useFilter,
  useNullableTimeRangeContext,
  View,
} from "@phoenix/components";
import { Annotation, AnnotationConfig } from "@phoenix/components/annotation";
import { AnnotationConfigDialog } from "@phoenix/components/annotation/AnnotationConfigDialog";
import { Empty } from "@phoenix/components/Empty";
import { FocusHotkey } from "@phoenix/components/FocusHotkey";
import type { SpanAnnotationsEditorAddAnnotationConfigToProjectMutation } from "@phoenix/components/trace/__generated__/SpanAnnotationsEditorAddAnnotationConfigToProjectMutation.graphql";
import { SpanAnnotationsEditorCreateAnnotationMutation } from "@phoenix/components/trace/__generated__/SpanAnnotationsEditorCreateAnnotationMutation.graphql";
import { SpanAnnotationsEditorDeleteAnnotationMutation } from "@phoenix/components/trace/__generated__/SpanAnnotationsEditorDeleteAnnotationMutation.graphql";
import { SpanAnnotationsEditorSpanAnnotationsListQuery } from "@phoenix/components/trace/__generated__/SpanAnnotationsEditorSpanAnnotationsListQuery.graphql";
import { AnnotationConfigList } from "@phoenix/components/trace/AnnotationConfigList";
import {
  AnnotationFormMutationResult,
  AnnotationFormProvider,
} from "@phoenix/components/trace/AnnotationFormProvider";
import { useNotifyError } from "@phoenix/contexts";
import { useViewer } from "@phoenix/contexts/ViewerContext";
import { AnnotationConfig as AnnotationConfigType } from "@phoenix/pages/settings/types";
import { deduplicateAnnotationsByName } from "@phoenix/pages/trace/utils";
import { isStringArray, Mutable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import { SpanAnnotationsEditor_spanAnnotations$key } from "./__generated__/SpanAnnotationsEditor_spanAnnotations.graphql";
import { SpanAnnotationsEditorCreateAnnotationConfigMutation } from "./__generated__/SpanAnnotationsEditorCreateAnnotationConfigMutation.graphql";
import { SpanAnnotationsEditorEditAnnotationMutation } from "./__generated__/SpanAnnotationsEditorEditAnnotationMutation.graphql";
import { AnnotationFormData, SpanAnnotationInput } from "./SpanAnnotationInput";

export const EDIT_ANNOTATION_HOTKEY = "e";

export type SpanAnnotationsEditorProps = {
  spanNodeId: string;
  projectId: string;
};

export function SpanAnnotationsEditor(props: SpanAnnotationsEditorProps) {
  const { projectId, spanNodeId } = props;
  const [newAnnotationName, setNewAnnotationName] = useState<string | null>(
    null
  );
  const [refetchKey, setRefetchKey] = useState(0);

  return (
    <View height="100%" maxHeight="100%" overflow="auto">
      <Flex direction="column" height="100%">
        <View
          paddingY="size-100"
          paddingX="size-100"
          borderBottomWidth="thin"
          borderColor="dark"
          width="100%"
          flex="none"
        >
          <Flex
            direction="row"
            alignItems="center"
            justifyContent="end"
            width="100%"
          >
            <NewAnnotationButton
              projectId={projectId}
              spanNodeId={spanNodeId}
              disabled={newAnnotationName !== null}
              onAnnotationNameSelect={setNewAnnotationName}
              refetchKey={refetchKey}
              onRefetchKeyChange={setRefetchKey}
            />
          </Flex>
        </View>
        <Suspense>
          <SpanAnnotationsList
            spanId={spanNodeId}
            projectId={projectId}
            annotationConfigsRefetchKey={refetchKey}
          />
        </Suspense>
      </Flex>
    </View>
  );
}

type NewAnnotationButtonProps = {
  projectId: string;
  spanNodeId: string;
  disabled?: boolean;
  onAnnotationNameSelect: (name: string) => void;
  refetchKey: number;
  onRefetchKeyChange: (updater: (prev: number) => number) => void;
};

function NewAnnotationButton(props: NewAnnotationButtonProps) {
  const {
    projectId,
    disabled = false,
    spanNodeId,
    onAnnotationNameSelect,
    refetchKey,
    onRefetchKeyChange,
  } = props;
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [showEditConfigDialog, setShowEditConfigDialog] = useState(false);

  const { viewer } = useViewer();
  const userFilter = useMemo(() => (viewer ? [viewer.id] : [null]), [viewer]);

  const [createAnnotationConfig] =
    useMutation<SpanAnnotationsEditorCreateAnnotationConfigMutation>(graphql`
      mutation SpanAnnotationsEditorCreateAnnotationConfigMutation(
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

  const [addAnnotationConfigToProject] =
    useMutation<SpanAnnotationsEditorAddAnnotationConfigToProjectMutation>(
      graphql`
        mutation SpanAnnotationsEditorAddAnnotationConfigToProjectMutation(
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

  const parseError = (callback?: (error: string) => void) => (error: Error) => {
    const formattedError = getErrorMessagesFromRelayMutationError(error);
    callback?.(formattedError?.[0] ?? "Failed to create annotation config");
  };

  const handleAddAnnotationConfig = (
    _config: AnnotationConfigType,
    {
      onCompleted,
      onError,
    }: { onCompleted?: () => void; onError?: (error: string) => void } = {}
  ) => {
    const { id: _, annotationType, ...config } = _config;
    const key = annotationType.toLowerCase();
    createAnnotationConfig({
      variables: {
        input: { annotationConfig: { [key]: config } },
      },
      onCompleted: (response) => {
        const annotationConfig =
          response.createAnnotationConfig.annotationConfig;
        const annotationConfigId = annotationConfig.id;
        if (annotationConfigId) {
          startTransition(() => {
            addAnnotationConfigToProject({
              variables: {
                projectId,
                annotationConfigId,
                spanId: spanNodeId,
                filterUserIds: isStringArray(userFilter) ? userFilter : null,
              },
              onCompleted: () => {
                onRefetchKeyChange((prev) => prev + 1);
                onCompleted?.();
              },
              onError: parseError(onError),
            });
          });
        } else {
          parseError(onError)(new Error("Failed to get annotation config ID"));
        }
      },
      onError: parseError(onError),
    });
  };

  return (
    <>
      <DialogTrigger isOpen={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <Button
          variant={disabled ? "default" : "primary"}
          isDisabled={disabled}
          size="S"
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
          aria-label="Add Annotation"
        >
          Annotation
        </Button>
        <Popover placement="bottom end">
          <PopoverArrow />
          <Dialog>
            <Suspense fallback={<Loading />}>
              <AnnotationList
                projectId={projectId}
                spanNodeId={spanNodeId}
                onAnnotationNameSelect={(name) => {
                  onAnnotationNameSelect(name);
                }}
                onOpenEditConfigDialog={() => {
                  setIsPopoverOpen(false);
                  setShowEditConfigDialog(true);
                }}
                refetchKey={refetchKey}
              />
            </Suspense>
          </Dialog>
        </Popover>
      </DialogTrigger>
      {showEditConfigDialog ? (
        <ModalOverlay
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setShowEditConfigDialog(false);
            }
          }}
        >
          <Modal>
            <AnnotationConfigDialog
              onAddAnnotationConfig={handleAddAnnotationConfig}
            />
          </Modal>
        </ModalOverlay>
      ) : null}
    </>
  );
}

type AnnotationListProps = {
  projectId: string;
  spanNodeId: string;
  onAnnotationNameSelect: (name: string) => void;
  onOpenEditConfigDialog: () => void;
  refetchKey: number;
};

function AnnotationList(props: AnnotationListProps) {
  const { projectId, spanNodeId, onOpenEditConfigDialog, refetchKey } = props;
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <Autocomplete filter={contains}>
      <AnnotationConfigList
        projectId={projectId}
        spanId={spanNodeId}
        refetchKey={refetchKey}
      />

      <View padding="size-100" borderTopWidth="thin" borderTopColor="dark">
        <Button
          variant="quiet"
          size="S"
          onPress={onOpenEditConfigDialog}
          css={css`
            width: 100%;
          `}
        >
          Edit Annotation Configs
        </Button>
      </View>
    </Autocomplete>
  );
}

/**
 * Exclude the explanation button from being focused via the focus manager
 */
const excludeExplanationButton: FocusManagerOptions["accept"] = (node) => {
  return !node.matches("button.annotation-input-explanation");
};

function SpanAnnotationsList(props: {
  spanId: string;
  projectId: string;
  extraAnnotationCards?: React.ReactNode;
  annotationConfigsRefetchKey?: number;
}) {
  const {
    spanId,
    projectId,
    extraAnnotationCards,
    annotationConfigsRefetchKey,
  } = props;
  const { viewer } = useViewer();
  const notifyError = useNotifyError();
  // If not authenticated, pass a null user to the query to get the system annotation
  const userFilter = useMemo(() => (viewer ? [viewer.id] : [null]), [viewer]);

  const data = useLazyLoadQuery<SpanAnnotationsEditorSpanAnnotationsListQuery>(
    graphql`
      query SpanAnnotationsEditorSpanAnnotationsListQuery(
        $projectId: ID!
        $spanId: ID!
        $filterUserIds: [ID]
      ) {
        project: node(id: $projectId) {
          id
          ... on Project {
            annotationConfigs {
              configs: edges {
                config: node {
                  __typename
                  ... on Node {
                    id
                  }
                  ... on AnnotationConfigBase {
                    name
                    annotationType
                    description
                  }
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
                    name
                  }
                }
              }
            }
          }
        }
        span: node(id: $spanId) {
          id
          ... on Span {
            ...SpanAnnotationsEditor_spanAnnotations
              @arguments(filterUserIds: $filterUserIds)
          }
        }
      }
    `,
    {
      projectId,
      spanId,
      filterUserIds: userFilter,
    },
    { fetchKey: annotationConfigsRefetchKey, fetchPolicy: "store-and-network" }
  );
  const span = useFragment<SpanAnnotationsEditor_spanAnnotations$key>(
    graphql`
      fragment SpanAnnotationsEditor_spanAnnotations on Span
      @argumentDefinitions(filterUserIds: { type: "[ID]" }) {
        id
        filteredSpanAnnotations: spanAnnotations(
          filter: {
            exclude: { names: ["note"] }
            include: { userIds: $filterUserIds }
          }
        ) {
          id
          name
          annotatorKind
          score
          label
          explanation
          createdAt
        }
      }
    `,
    data.span
  );
  const spanNodeId = data.span.id;
  const spanAnnotations = span.filteredSpanAnnotations as Mutable<
    typeof span.filteredSpanAnnotations
  >;
  const annotations = useMemo(() => {
    // we can only show one config per annotation name
    // so we need to group by name and pick the most recent one
    return deduplicateAnnotationsByName(spanAnnotations);
  }, [spanAnnotations]);
  const currentAnnotationIds = useMemo(
    () => new Set(annotations.map((annotation) => annotation.id)),
    [annotations]
  );
  const annotationConfigs = data.project?.annotationConfigs?.configs;
  const annotationConfigsLength = annotationConfigs?.length ?? 0;
  // time range is nullable in this context
  // we only use it to refresh fragments after mutations so it is ok to not have a time range context
  const timeRangeContext = useNullableTimeRangeContext();
  const timeRange = timeRangeContext?.timeRange;

  const [commitDeleteAnnotation] =
    useMutation<SpanAnnotationsEditorDeleteAnnotationMutation>(graphql`
      mutation SpanAnnotationsEditorDeleteAnnotationMutation(
        $spanId: ID!
        $annotationIds: [ID!]!
        $timeRange: TimeRange!
        $projectId: ID!
        $filterUserIds: [ID]
      ) {
        deleteSpanAnnotations(input: { annotationIds: $annotationIds }) {
          query {
            project: node(id: $projectId) {
              ... on Project {
                ...ProjectPageHeader_stats
              }
            }
            node(id: $spanId) {
              ... on Span {
                ...AnnotationSummaryGroup
                ...TraceHeaderRootSpanAnnotationsFragment
                ...SpanAnnotationsEditor_spanAnnotations
                  @arguments(filterUserIds: $filterUserIds)
                ...SpanAsideAnnotationList_span
                ...SpanFeedback_annotations
              }
            }
          }
        }
      }
    `);
  const handleDelete = useCallback(
    (annotation: Annotation) =>
      new Promise<AnnotationFormMutationResult>((resolve) => {
        if (annotation.id) {
          commitDeleteAnnotation({
            variables: {
              spanId: spanNodeId,
              annotationIds: [annotation.id],
              timeRange: {
                start: timeRange?.start?.toISOString(),
                end: timeRange?.end?.toISOString(),
              },
              projectId,
              filterUserIds: userFilter,
            },
            onCompleted: () => {
              resolve({
                success: true,
              });
            },
            onError: (error) => {
              resolve({
                success: false,
                error: error.message,
              });
              notifyError({
                title: "Error deleting annotation",
                message: error.message,
              });
            },
          });
        } else {
          resolve({
            success: true,
          });
        }
      }),
    [
      commitDeleteAnnotation,
      spanNodeId,
      timeRange,
      projectId,
      notifyError,
      userFilter,
    ]
  );

  const [commitEdit] = useMutation<SpanAnnotationsEditorEditAnnotationMutation>(
    graphql`
      mutation SpanAnnotationsEditorEditAnnotationMutation(
        $spanId: ID!
        $annotationId: ID!
        $name: String!
        $label: String
        $score: Float
        $explanation: String
        $filterUserIds: [ID]
        $timeRange: TimeRange!
        $projectId: ID!
      ) {
        patchSpanAnnotations(
          input: [
            {
              annotationId: $annotationId
              name: $name
              label: $label
              score: $score
              explanation: $explanation
              annotatorKind: HUMAN
              source: APP
            }
          ]
        ) {
          query {
            project: node(id: $projectId) {
              ... on Project {
                ...AnnotationSummaryValueFragment
                  @arguments(annotationName: $name, timeRange: $timeRange)
              }
            }
            node(id: $spanId) {
              ... on Span {
                ...AnnotationSummaryGroup
                ...TraceHeaderRootSpanAnnotationsFragment
                ...SpanAnnotationsEditor_spanAnnotations
                  @arguments(filterUserIds: $filterUserIds)
                ...SpanAsideAnnotationList_span
                ...SpanFeedback_annotations
              }
            }
          }
        }
      }
    `
  );
  const handleEdit = useCallback(
    (data: Annotation) => {
      return new Promise<AnnotationFormMutationResult>((resolve) => {
        const annotationId = data.id;
        if (annotationId) {
          startTransition(() => {
            commitEdit({
              variables: {
                annotationId,
                spanId: spanNodeId,
                name: data.name,
                label: data.label,
                score: data.score,
                explanation: data.explanation || null,
                filterUserIds: userFilter,
                timeRange: {
                  start: timeRange?.start?.toISOString(),
                  end: timeRange?.end?.toISOString(),
                },
                projectId,
              },
              onCompleted: () => {
                resolve({
                  success: true,
                });
              },
              onError: (error) => {
                resolve({
                  success: false,
                  error: error.message,
                });
                notifyError({
                  title: "Error editing annotation",
                  message: error.message,
                });
              },
            });
          });
        }
      });
    },
    [commitEdit, spanNodeId, userFilter, timeRange, projectId, notifyError]
  );

  const [commitCreateAnnotation] =
    useMutation<SpanAnnotationsEditorCreateAnnotationMutation>(graphql`
      mutation SpanAnnotationsEditorCreateAnnotationMutation(
        $name: String!
        $input: CreateSpanAnnotationInput!
        $spanId: ID!
        $filterUserIds: [ID]
        $timeRange: TimeRange!
        $projectId: ID!
      ) {
        createSpanAnnotations(input: [$input]) {
          query {
            project: node(id: $projectId) {
              ... on Project {
                ...AnnotationSummaryValueFragment
                  @arguments(annotationName: $name, timeRange: $timeRange)
              }
            }
            node(id: $spanId) {
              ... on Span {
                ...AnnotationSummaryGroup
                ...TraceHeaderRootSpanAnnotationsFragment
                ...SpanAnnotationsEditor_spanAnnotations
                  @arguments(filterUserIds: $filterUserIds)
                ...SpanAsideAnnotationList_span
                ...SpanFeedback_annotations
              }
            }
          }
        }
      }
    `);
  const handleCreate = useCallback(
    (data: AnnotationFormData) =>
      new Promise<AnnotationFormMutationResult>((resolve) => {
        commitCreateAnnotation({
          variables: {
            input: {
              ...data,
              spanId: spanNodeId,
              annotatorKind: "HUMAN",
              explanation: data.explanation || null,
              source: "APP",
            },
            name: data.name,
            spanId: spanNodeId,
            filterUserIds: userFilter,
            timeRange: {
              start: timeRange?.start?.toISOString(),
              end: timeRange?.end?.toISOString(),
            },
            projectId,
          },
          onCompleted: () => {
            resolve({
              success: true,
            });
          },
          onError: (error) => {
            resolve({
              success: false,
              error: error.message,
            });
            notifyError({
              title: "Error creating annotation",
              message: error.message,
            });
          },
        });
      }),
    [
      commitCreateAnnotation,
      spanNodeId,
      timeRange,
      projectId,
      notifyError,
      userFilter,
    ]
  );

  return (
    <View
      height="100%"
      maxHeight="100%"
      overflow="auto"
      width="100%"
      padding="size-200"
    >
      {!annotationConfigsLength && !extraAnnotationCards && (
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="center"
          height="100%"
        >
          <Empty message="No annotation configurations for this project." />
        </Flex>
      )}
      {!!annotationConfigsLength && (
        <FocusScope>
          <FocusHotkey
            hotkey={EDIT_ANNOTATION_HOTKEY}
            accept={excludeExplanationButton}
          />
          {annotationConfigs?.map((annotationConfig, idx) => {
            const annotation = annotations.find(
              (annotation) => annotation.name === annotationConfig.config.name
            );
            return (
              <AnnotationFormProvider
                key={`${idx}_${annotationConfig.config.name}_form`}
                annotationConfig={annotationConfig.config as AnnotationConfig}
                currentAnnotationIDs={currentAnnotationIds}
                annotation={annotation}
                onCreate={handleCreate}
                onUpdate={handleEdit}
                onDelete={handleDelete}
              >
                <SpanAnnotationInput
                  annotation={annotation}
                  annotationConfig={annotationConfig.config as AnnotationConfig}
                />
              </AnnotationFormProvider>
            );
          })}
        </FocusScope>
      )}
    </View>
  );
}
