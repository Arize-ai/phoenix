import { css } from "@emotion/react";
import {
  startTransition,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import type { FocusManagerOptions } from "react-aria";
import { FocusScope } from "react-aria";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";
import invariant from "tiny-invariant";

import {
  Alert,
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
  Text,
  useFilter,
  View,
} from "@phoenix/components";
import type {
  Annotation,
  AnnotationConfig,
} from "@phoenix/components/annotation";
import { AnnotationConfigDialog } from "@phoenix/components/annotation/AnnotationConfigDialog";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { FocusHotkey } from "@phoenix/components/FocusHotkey";
import type { SessionAnnotationsEditor_sessionAnnotations$key } from "@phoenix/components/trace/__generated__/SessionAnnotationsEditor_sessionAnnotations.graphql";
import type { SessionAnnotationsEditorAddAnnotationConfigToProjectMutation } from "@phoenix/components/trace/__generated__/SessionAnnotationsEditorAddAnnotationConfigToProjectMutation.graphql";
import type {
  AnnotationConfigInput,
  SessionAnnotationsEditorCreateAnnotationConfigMutation,
} from "@phoenix/components/trace/__generated__/SessionAnnotationsEditorCreateAnnotationConfigMutation.graphql";
import type { SessionAnnotationsEditorCreateAnnotationMutation } from "@phoenix/components/trace/__generated__/SessionAnnotationsEditorCreateAnnotationMutation.graphql";
import type { SessionAnnotationsEditorDeleteAnnotationMutation } from "@phoenix/components/trace/__generated__/SessionAnnotationsEditorDeleteAnnotationMutation.graphql";
import type { SessionAnnotationsEditorEditAnnotationMutation } from "@phoenix/components/trace/__generated__/SessionAnnotationsEditorEditAnnotationMutation.graphql";
import type { SessionAnnotationsEditorSessionAnnotationsListQuery } from "@phoenix/components/trace/__generated__/SessionAnnotationsEditorSessionAnnotationsListQuery.graphql";
import { AnnotationConfigList } from "@phoenix/components/trace/AnnotationConfigList";
import type { AnnotationFormMutationResult } from "@phoenix/components/trace/AnnotationFormProvider";
import { AnnotationFormProvider } from "@phoenix/components/trace/AnnotationFormProvider";
import { EDIT_ANNOTATION_HOTKEY } from "@phoenix/constants/annotationConstants";
import { useViewer } from "@phoenix/contexts/ViewerContext";
import type { AnnotationConfig as AnnotationConfigType } from "@phoenix/pages/settings/types";
import { deduplicateAnnotationsByName } from "@phoenix/pages/trace/utils";
import type { Mutable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { AnnotationFormData } from "./SpanAnnotationInput";
import { SpanAnnotationInput } from "./SpanAnnotationInput";

export type SessionAnnotationsEditorProps = {
  sessionNodeId: string;
  projectId: string;
};

/**
 * The editor's header bar, pinned to the top of the full-height annotations
 * panel.
 */
const annotateSessionHeaderCSS = css`
  box-sizing: border-box;
  flex: none;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--global-dimension-size-100);
  border-bottom: 1px solid var(--global-border-color-default);
`;

export function SessionAnnotationsEditor(props: SessionAnnotationsEditorProps) {
  const { projectId, sessionNodeId } = props;
  const [refetchKey, setRefetchKey] = useState(0);

  return (
    <View height="100%" maxHeight="100%" overflow="auto">
      <Flex direction="column" height="100%">
        <div css={annotateSessionHeaderCSS}>
          <Text elementType="h3" size="S" weight="heavy">
            Annotate Session
          </Text>
          <NewAnnotationButton
            projectId={projectId}
            refetchKey={refetchKey}
            onRefetchKeyChange={setRefetchKey}
          />
        </div>
        <Suspense>
          <SessionAnnotationsList
            sessionId={sessionNodeId}
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
  refetchKey: number;
  onRefetchKeyChange: (updater: (prev: number) => number) => void;
};

function NewAnnotationButton(props: NewAnnotationButtonProps) {
  const { projectId, refetchKey, onRefetchKeyChange } = props;
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [showEditConfigDialog, setShowEditConfigDialog] = useState(false);

  const [createAnnotationConfig] =
    useMutation<SessionAnnotationsEditorCreateAnnotationConfigMutation>(graphql`
      mutation SessionAnnotationsEditorCreateAnnotationConfigMutation(
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
    useMutation<SessionAnnotationsEditorAddAnnotationConfigToProjectMutation>(
      graphql`
        mutation SessionAnnotationsEditorAddAnnotationConfigToProjectMutation(
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
                  ...AnnotationConfigListProjectAnnotationConfigFragment
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
    let annotationConfigInput: AnnotationConfigInput;
    switch (_config.annotationType) {
      case "CATEGORICAL": {
        const {
          id: _,
          annotationType: _type,
          optimizationDirection,
          values,
          ...categorical
        } = _config;
        invariant(
          optimizationDirection,
          "optimizationDirection is required for a categorical annotation config"
        );
        invariant(
          values,
          "values are required for a categorical annotation config"
        );
        annotationConfigInput = {
          categorical: { ...categorical, optimizationDirection, values },
        };
        break;
      }
      case "CONTINUOUS": {
        const {
          id: _,
          annotationType: _type,
          optimizationDirection,
          ...continuous
        } = _config;
        invariant(
          optimizationDirection,
          "optimizationDirection is required for a continuous annotation config"
        );
        annotationConfigInput = {
          continuous: { ...continuous, optimizationDirection },
        };
        break;
      }
      case "FREEFORM": {
        const { id: _, annotationType: _type, ...freeform } = _config;
        annotationConfigInput = { freeform };
        break;
      }
    }
    createAnnotationConfig({
      variables: {
        input: { annotationConfig: annotationConfigInput },
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
          variant="primary"
          size="S"
          leadingVisual={<Icon svg={<Icons.Plus />} />}
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
  onOpenEditConfigDialog: () => void;
  refetchKey: number;
};

function AnnotationList(props: AnnotationListProps) {
  const { projectId, onOpenEditConfigDialog, refetchKey } = props;
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <Autocomplete filter={contains}>
      <AnnotationConfigList projectId={projectId} refetchKey={refetchKey} />

      <View padding="size-100" borderTopWidth="thin" borderTopColor="default">
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

function SessionAnnotationsList(props: {
  sessionId: string;
  projectId: string;
  annotationConfigsRefetchKey?: number;
}) {
  const { sessionId, projectId, annotationConfigsRefetchKey } = props;
  const { viewer } = useViewer();
  const [error, setError] = useState<string | null>(null);

  const data =
    useLazyLoadQuery<SessionAnnotationsEditorSessionAnnotationsListQuery>(
      graphql`
        query SessionAnnotationsEditorSessionAnnotationsListQuery(
          $projectId: ID!
          $sessionId: ID!
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
                      optimizationDirection
                      threshold
                    }
                  }
                }
              }
            }
          }
          session: node(id: $sessionId) {
            id
            ... on ProjectSession {
              ...SessionAnnotationsEditor_sessionAnnotations
            }
          }
        }
      `,
      {
        projectId,
        sessionId,
      },
      {
        fetchKey: annotationConfigsRefetchKey,
        fetchPolicy: "store-and-network",
      }
    );
  const session = useFragment<SessionAnnotationsEditor_sessionAnnotations$key>(
    graphql`
      fragment SessionAnnotationsEditor_sessionAnnotations on ProjectSession {
        id
        sessionAnnotations {
          id
          name
          annotatorKind
          score
          label
          explanation
          createdAt
          user {
            id
            username
            profilePictureUrl
          }
        }
      }
    `,
    data.session
  );
  const sessionNodeId = data.session.id;
  const allSessionAnnotations = session.sessionAnnotations as Mutable<
    typeof session.sessionAnnotations
  >;
  // Only the current user's annotations are editable in this form. When
  // unauthenticated, fall back to system annotations (no associated user).
  const sessionAnnotations = useMemo(
    () =>
      allSessionAnnotations.filter((annotation) => {
        if (annotation.name === "note") {
          return false;
        }
        return viewer
          ? annotation.user?.id === viewer.id
          : annotation.user == null;
      }),
    [allSessionAnnotations, viewer]
  );
  const annotations = useMemo(() => {
    // we can only show one config per annotation name
    // so we need to group by name and pick the most recent one
    return deduplicateAnnotationsByName(sessionAnnotations);
  }, [sessionAnnotations]);
  const currentAnnotationIds = useMemo(
    () => new Set(annotations.map((annotation) => annotation.id)),
    [annotations]
  );
  const annotationConfigs = data.project?.annotationConfigs?.configs;
  const annotationConfigsLength = annotationConfigs?.length ?? 0;

  const [commitDeleteAnnotation] =
    useMutation<SessionAnnotationsEditorDeleteAnnotationMutation>(graphql`
      mutation SessionAnnotationsEditorDeleteAnnotationMutation(
        $sessionId: ID!
        $annotationId: ID!
      ) {
        deleteProjectSessionAnnotation(id: $annotationId) {
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
    `);
  const handleDelete = useCallback(
    (annotation: Annotation) =>
      new Promise<AnnotationFormMutationResult>((resolve) => {
        setError(null);
        if (annotation.id) {
          commitDeleteAnnotation({
            variables: {
              sessionId: sessionNodeId,
              annotationId: annotation.id,
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
              setError(error.message);
            },
          });
        } else {
          resolve({
            success: true,
          });
        }
      }),
    [commitDeleteAnnotation, sessionNodeId]
  );

  const [commitEdit] =
    useMutation<SessionAnnotationsEditorEditAnnotationMutation>(graphql`
      mutation SessionAnnotationsEditorEditAnnotationMutation(
        $sessionId: ID!
        $annotationId: ID!
        $name: String!
        $label: String
        $score: Float
        $explanation: String
      ) {
        updateProjectSessionAnnotations(
          input: {
            id: $annotationId
            name: $name
            label: $label
            score: $score
            explanation: $explanation
            annotatorKind: HUMAN
            source: APP
            metadata: {}
          }
        ) {
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
    `);
  const handleEdit = useCallback(
    (data: Annotation) => {
      return new Promise<AnnotationFormMutationResult>((resolve) => {
        setError(null);
        const annotationId = data.id;
        if (annotationId) {
          startTransition(() => {
            commitEdit({
              variables: {
                annotationId,
                sessionId: sessionNodeId,
                name: data.name,
                label: data.label,
                score: data.score,
                explanation: data.explanation || null,
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
                setError(error.message);
              },
            });
          });
        }
      });
    },
    [commitEdit, sessionNodeId]
  );

  const [commitCreateAnnotation] =
    useMutation<SessionAnnotationsEditorCreateAnnotationMutation>(graphql`
      mutation SessionAnnotationsEditorCreateAnnotationMutation(
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
    `);
  const handleCreate = useCallback(
    (data: AnnotationFormData) =>
      new Promise<AnnotationFormMutationResult>((resolve) => {
        setError(null);
        commitCreateAnnotation({
          variables: {
            input: {
              ...data,
              projectSessionId: sessionNodeId,
              annotatorKind: "HUMAN",
              explanation: data.explanation || null,
              source: "APP",
              metadata: {},
            },
            sessionId: sessionNodeId,
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
            setError(error.message);
          },
        });
      }),
    [commitCreateAnnotation, sessionNodeId]
  );

  return (
    <View
      height="100%"
      maxHeight="100%"
      overflow="auto"
      width="100%"
      padding="size-200"
    >
      {error && <Alert variant="danger">{error}</Alert>}
      {!annotationConfigsLength && (
        <Flex
          direction="column"
          alignItems="center"
          justifyContent="center"
          height="100%"
        >
          <CompactEmptyState
            icon={<Icon svg={<Icons.Settings />} />}
            description="No annotation configurations for this project."
          />
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
