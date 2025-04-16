import React, {
  startTransition,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { FocusScope } from "react-aria";
import { FormProvider, useForm } from "react-hook-form";
import {
  graphql,
  useFragment,
  useLazyLoadQuery,
  useMutation,
} from "react-relay";

import { Card } from "@arizeai/components";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Popover,
  View,
} from "@phoenix/components";
import { Annotation, AnnotationConfig } from "@phoenix/components/annotation";
import { AnnotationSaveButton } from "@phoenix/components/annotation/AnnotationSaveButton";
import { Empty } from "@phoenix/components/Empty";
import { SpanAnnotationsEditorCreateAnnotationMutation } from "@phoenix/components/trace/__generated__/SpanAnnotationsEditorCreateAnnotationMutation.graphql";
import { SpanAnnotationsEditorDeleteAnnotationMutation } from "@phoenix/components/trace/__generated__/SpanAnnotationsEditorDeleteAnnotationMutation.graphql";
import { SpanAnnotationsEditorSpanAnnotationsListQuery } from "@phoenix/components/trace/__generated__/SpanAnnotationsEditorSpanAnnotationsListQuery.graphql";
import { AnnotationConfigList } from "@phoenix/components/trace/AnnotationConfigList";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { useViewer } from "@phoenix/contexts/ViewerContext";

import { SpanAnnotationsEditor_spanAnnotations$key } from "./__generated__/SpanAnnotationsEditor_spanAnnotations.graphql";
import { SpanAnnotationsEditorEditAnnotationMutation } from "./__generated__/SpanAnnotationsEditorEditAnnotationMutation.graphql";
import { AnnotationFormData, SpanAnnotationInput } from "./SpanAnnotationInput";

export type SpanAnnotationsEditorProps = {
  spanNodeId: string;
  projectId: string;
};

export function SpanAnnotationsEditor(props: SpanAnnotationsEditorProps) {
  const { projectId, spanNodeId } = props;
  const [newAnnotationName, setNewAnnotationName] = useState<string | null>(
    null
  );
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
            />
          </Flex>
        </View>
        <Suspense>
          <SpanAnnotationsList spanId={spanNodeId} projectId={projectId} />
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
};

function NewAnnotationButton(props: NewAnnotationButtonProps) {
  const {
    projectId,
    disabled = false,
    spanNodeId,
    onAnnotationNameSelect,
  } = props;
  const [popoverRef, setPopoverRef] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <DialogTrigger>
        <Button
          variant={disabled ? "default" : "primary"}
          isDisabled={disabled}
          size="S"
          leadingVisual={<Icon svg={<Icons.PlusCircleOutline />} />}
        >
          Add Annotation
        </Button>
        <Popover
          style={{ border: "none" }}
          placement="bottom end"
          crossOffset={300}
          UNSTABLE_portalContainer={popoverRef ?? undefined}
        >
          <Dialog>
            {({ close }) => (
              <NewAnnotationCard
                projectId={projectId}
                spanNodeId={spanNodeId}
                onAnnotationNameSelect={(name) => {
                  onAnnotationNameSelect(name);
                }}
                onClose={close}
              />
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
      <div ref={setPopoverRef} />
    </>
  );
}

type NewAnnotationCardProps = {
  projectId: string;
  spanNodeId: string;
  onClose: () => void;
  onAnnotationNameSelect: (name: string) => void;
};

function NewAnnotationCard(props: NewAnnotationCardProps) {
  const { projectId, spanNodeId, onClose } = props;
  return (
    <Card
      title="Add Annotation from Config"
      backgroundColor="light"
      borderColor="light"
      variant="compact"
      bodyStyle={{ padding: 0 }}
    >
      <Suspense>
        <NewAnnotationFromConfig
          projectId={projectId}
          spanId={spanNodeId}
          onClose={onClose}
          renderNewAnnotationForm={null}
        />
      </Suspense>
    </Card>
  );
}

function SpanAnnotationsList(props: {
  spanId: string;
  projectId: string;
  extraAnnotationCards?: React.ReactNode;
}) {
  const { spanId, projectId, extraAnnotationCards } = props;
  const { viewer } = useViewer();

  const data = useLazyLoadQuery<SpanAnnotationsEditorSpanAnnotationsListQuery>(
    graphql`
      query SpanAnnotationsEditorSpanAnnotationsListQuery(
        $projectId: GlobalID!
        $spanId: GlobalID!
        $filterUserIds: [GlobalID!]
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
      filterUserIds: viewer?.id ? [viewer.id] : null,
    }
  );
  const span = useFragment<SpanAnnotationsEditor_spanAnnotations$key>(
    graphql`
      fragment SpanAnnotationsEditor_spanAnnotations on Span
      @argumentDefinitions(filterUserIds: { type: "[GlobalID!]" }) {
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
        }
      }
    `,
    data.span
  );
  const spanNodeId = data.span.id;
  const annotations = span.filteredSpanAnnotations;
  const currentAnnotationsById = annotations.reduce(
    (acc, annotation) => {
      acc[annotation.id!] = annotation;
      return acc;
    },
    {} as Record<string, Annotation>
  );
  const annotationConfigs = data.project?.annotationConfigs?.configs;
  const annotationConfigsLength = annotationConfigs?.length ?? 0;
  const values =
    annotationConfigs?.reduce(
      (acc, { config }) => {
        const annotation = annotations.find(
          (annotation) => annotation.name === config.name
        );
        if (annotation) {
          acc[config.name!] = annotation;
        } else {
          acc[config.name!] = {
            name: config.name!,
            label: null,
            score: null,
            explanation: null,
          };
        }
        return acc;
      },
      {} as Record<string, Annotation>
    ) ?? ({} as Record<string, Annotation>);

  const form = useForm({
    values,
    resetOptions: {
      keepDirtyValues: true,
      keepDirty: false,
    },
  });

  const [commitDeleteAnnotation, isCommittingDeleteAnnotation] =
    useMutation<SpanAnnotationsEditorDeleteAnnotationMutation>(graphql`
      mutation SpanAnnotationsEditorDeleteAnnotationMutation(
        $spanId: GlobalID!
        $annotationIds: [GlobalID!]!
      ) {
        deleteSpanAnnotations(input: { annotationIds: $annotationIds }) {
          query {
            node(id: $spanId) {
              ... on Span {
                ...SpanAnnotationsEditor_spanAnnotations
                ...SpanAsideAnnotationList_span
                ...SpanFeedback_annotations
              }
            }
          }
        }
      }
    `);

  const [commitEdit, isCommittingEdit] =
    useMutation<SpanAnnotationsEditorEditAnnotationMutation>(graphql`
      mutation SpanAnnotationsEditorEditAnnotationMutation(
        $spanId: GlobalID!
        $annotationId: GlobalID!
        $name: String!
        $label: String
        $score: Float
        $explanation: String
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
            }
          ]
        ) {
          query {
            node(id: $spanId) {
              ... on Span {
                ...SpanAnnotationsEditor_spanAnnotations
                ...SpanAsideAnnotationList_span
                ...SpanFeedback_annotations
              }
            }
          }
        }
      }
    `);
  const handleDelete = useCallback(
    (annotationIds: string[]) =>
      new Promise((resolve) => {
        commitDeleteAnnotation({
          variables: { spanId: spanNodeId, annotationIds },
          onCompleted: () => {
            resolve({
              error: null,
              title: "Annotation Deleted",
              message: `${annotationIds.length} annotation${
                annotationIds.length === 1 ? " has" : "s have"
              } been deleted.`,
            });
          },
          onError: (error) => {
            resolve({
              error: error,
            });
          },
        });
      }),
    [commitDeleteAnnotation, spanNodeId]
  );
  const { setError } = form;
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const handleEdit = useMemo(
    () =>
      (args: { annotationId: string; annotationName: string }) =>
      (data: AnnotationFormData) => {
        return new Promise((resolve) => {
          if (args.annotationId) {
            startTransition(() => {
              commitEdit({
                variables: {
                  annotationId: args.annotationId,
                  spanId: spanNodeId,
                  ...data,
                },
                onCompleted: () => {
                  resolve({
                    error: null,
                    title: "Annotation Updated",
                    message: `Annotation ${args.annotationName} has been updated.`,
                  });
                },
                onError: (error) => {
                  setError(args.annotationName, {
                    message: error.message,
                  });
                  resolve({
                    error: error,
                  });
                },
              });
            });
          }
        });
      },
    [commitEdit, spanNodeId, setError]
  );

  const [commitCreateAnnotation, isCommittingCreateAnnotation] =
    useMutation<SpanAnnotationsEditorCreateAnnotationMutation>(graphql`
      mutation SpanAnnotationsEditorCreateAnnotationMutation(
        $input: CreateSpanAnnotationInput!
        $spanId: GlobalID!
      ) {
        createSpanAnnotations(input: [$input]) {
          query {
            node(id: $spanId) {
              ... on Span {
                ...SpanAnnotationsEditor_spanAnnotations
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
      new Promise((resolve) => {
        commitCreateAnnotation({
          variables: {
            input: {
              spanId: spanNodeId,
              annotatorKind: "HUMAN",
              ...data,
              source: "APP",
            },
            spanId: spanNodeId,
          },
          onCompleted: () => {
            resolve({
              error: null,
              title: "Annotation Created",
              message: `Annotation ${data.name} has been created.`,
            });
          },
          onError: (error) => {
            setError(data.name, {
              message: error.message,
            });
            resolve({
              error: error,
            });
          },
        });
      }),
    [commitCreateAnnotation, spanNodeId, setError]
  );

  // TODO: update this so that it only updates one annotation at a time, on blur
  // - add a delete button that appears on hover beside the inputs
  // - move the explanation button to a clickable link next to the input label
  const submit = form.handleSubmit(async (data) => {
    try {
      // step 1: accumulate the Ids of any existing annotations do not exist in the data, if so, delete them
      // step 2: accumulate the Ids of any existing annotations that do exist in the data, if so, update them
      // step 3: create any new annotations that do not exist in the data
      // we will create an array for each of the steps, and then process the arrays with the proper mutation
      // the incoming data is an object with the annotation/annotation config name as the key and the annotation data as the value
      const allData = Object.values(data);
      const annotationsToDelete: string[] = [];
      const annotationsToEdit: (Annotation & { id: string })[] = [];
      const annotationsToCreate: (Annotation & { id: undefined })[] = [];
      for (const annotation of allData) {
        if (
          (annotation.id && !currentAnnotationsById[annotation.id]) ||
          (annotation.id && annotation.score == null && !annotation.label) ||
          (annotation.id &&
            isNaN(annotation.score as number) &&
            !annotation.label)
        ) {
          annotationsToDelete.push(annotation.id);
          continue;
        } else if (annotation.id && currentAnnotationsById[annotation.id]) {
          annotationsToEdit.push({
            ...currentAnnotationsById[annotation.id],
            ...annotation,
            id: annotation.id,
          });
          continue;
        } else {
          annotationsToCreate.push({ ...annotation, id: undefined });
          continue;
        }
      }

      // do all of the deletes first
      const annotationDeletes = await handleDelete(annotationsToDelete);
      // concurrently edit the annotations
      const annotationEdits = Promise.all(
        annotationsToEdit.map((annotation) =>
          handleEdit({
            annotationId: annotation.id,
            annotationName: annotation.name,
          })(annotation)
        )
      );
      // concurrently create the annotations
      const annotationCreates = Promise.all(
        annotationsToCreate.map((annotation) => handleCreate(annotation))
      );
      await Promise.all([
        annotationDeletes,
        annotationEdits,
        annotationCreates,
      ]);
      const deletes = await annotationDeletes;
      const edits = await annotationEdits;
      const creates = await annotationCreates;
      const allResults = [deletes, ...edits, ...creates];
      const errors = allResults
        .filter(
          // @ts-expect-error promise types aren't being inferred by mutation resolvers
          (result) => result?.error as string
        )
        .map((result) => result);
      if (errors.length > 0) {
        notifyError({
          title: "Errors occurred while updating annotations",
          message: errors.join("\n"),
        });
      }
      const successes = allResults
        .filter(
          // @ts-expect-error promise types aren't being inferred by mutation resolvers
          (result) => !result?.error
        )
        .map((result) => result);
      if (successes.length > 0) {
        notifySuccess({
          title: "Annotations updated",
          message: successes
            .map((result) => {
              // @ts-expect-error promise types aren't being inferred by mutation resolvers
              return result?.message;
            })
            .join("\n"),
        });
      }
    } catch (e) {
      notifyError({
        title: "Error updating annotations",
        message: "An unknown error occurred while updating annotations",
      });
      // eslint-disable-next-line no-console
      console.error(e);
    }
  });

  return (
    <View
      height="100%"
      maxHeight="100%"
      overflow="auto"
      width="100%"
      padding="size-200"
    >
      {!annotationConfigsLength && !extraAnnotationCards && (
        <Empty
          graphicKey="documents"
          message="No annotation configurations for this project"
        />
      )}
      {!!annotationConfigsLength && (
        <FormProvider {...form}>
          <form onSubmit={submit}>
            <fieldset
              key={annotationConfigsLength}
              css={{
                all: "unset",
                width: "100%",
              }}
              disabled={
                isCommittingCreateAnnotation ||
                isCommittingEdit ||
                isCommittingDeleteAnnotation
              }
            >
              <FocusScope autoFocus>
                {annotationConfigs?.map((annotationConfig, idx) => (
                  <SpanAnnotationInput
                    key={`${idx}_${annotationConfig.config.name}`}
                    annotationConfig={
                      annotationConfig.config as AnnotationConfig
                    }
                    annotation={annotations.find(
                      (annotation) =>
                        annotation.name === annotationConfig.config.name
                    )}
                  />
                ))}
                <View marginTop="size-200">
                  <AnnotationSaveButton
                    isDisabled={!form.formState.isDirty}
                    type="submit"
                  >
                    Save Annotations
                  </AnnotationSaveButton>
                </View>
              </FocusScope>
            </fieldset>
          </form>
        </FormProvider>
      )}
    </View>
  );
}

function NewAnnotationFromConfig(props: {
  projectId: string;
  spanId: string;
  onClose: () => void;
  renderNewAnnotationForm: React.ReactNode;
}) {
  const { projectId, spanId, renderNewAnnotationForm } = props;
  return (
    <View minWidth={320}>
      <Suspense fallback={<Loading />}>
        <Flex direction="column" gap="size-100">
          <AnnotationConfigList
            projectId={projectId}
            spanId={spanId}
            renderNewAnnotationForm={renderNewAnnotationForm}
          />
        </Flex>
      </Suspense>
    </View>
  );
}
