import React, {
  startTransition,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  graphql,
  useLazyLoadQuery,
  useMutation,
  useRefetchableFragment,
} from "react-relay";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import {
  Alert,
  Button,
  Dialog,
  DialogTrigger,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Loading,
  Popover,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { Empty } from "@phoenix/components/Empty";
import { AnnotationConfigList } from "@phoenix/components/trace/AnnotationConfigList";
import { useNotifySuccess } from "@phoenix/contexts";

import {
  SpanAnnotationsEditor_spanAnnotations$data,
  SpanAnnotationsEditor_spanAnnotations$key,
} from "./__generated__/SpanAnnotationsEditor_spanAnnotations.graphql";
import { SpanAnnotationsEditorEditAnnotationMutation } from "./__generated__/SpanAnnotationsEditorEditAnnotationMutation.graphql";
import { SpanAnnotationsEditorNewAnnotationQuery } from "./__generated__/SpanAnnotationsEditorNewAnnotationQuery.graphql";
import { SpanAnnotationsEditorQuery } from "./__generated__/SpanAnnotationsEditorQuery.graphql";
import { SpanAnnotationsEditorSpanAnnotationsQuery } from "./__generated__/SpanAnnotationsEditorSpanAnnotationsQuery.graphql";
import { AnnotatorKindToken } from "./AnnotatorKindToken";
import { NewSpanAnnotationForm } from "./NewSpanAnnotationForm";
import { SpanAnnotationActionMenu } from "./SpanAnnotationActionMenu";
import { AnnotationFormData, SpanAnnotationForm } from "./SpanAnnotationForm";
export type SpanAnnotationsEditorProps = {
  spanNodeId: string;
  projectId: string;
};

export function SpanAnnotationsEditor(props: SpanAnnotationsEditorProps) {
  const { projectId, spanNodeId } = props;
  const [newAnnotationName, setNewAnnotationName] = useState<string | null>(
    null
  );
  const notifySuccess = useNotifySuccess();
  return (
    <View height="100%" maxHeight="100%" overflow="auto">
      <Flex direction="column" height="100%">
        <Suspense>
          <EditSpanAnnotations
            extraAnnotationCards={
              newAnnotationName ? (
                <NewSpanAnnotationDisclosure
                  spanNodeId={spanNodeId}
                  name={newAnnotationName}
                  onDelete={() => {
                    setNewAnnotationName(null);
                  }}
                  onCreated={() => {
                    setNewAnnotationName(null);
                    notifySuccess({
                      title: `New Span Annotation`,
                      message: `Annotation ${newAnnotationName} has been created.`,
                    });
                  }}
                />
              ) : null
            }
            {...props}
          />
        </Suspense>
        <View
          paddingY="size-100"
          paddingX="size-100"
          borderTopWidth="thin"
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
  const { projectId, spanNodeId, onAnnotationNameSelect, onClose } = props;
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
          renderNewAnnotationForm={
            <NewAnnotationInput
              projectId={projectId}
              spanId={spanNodeId}
              onAnnotationNameSelect={onAnnotationNameSelect}
              onClose={onClose}
            />
          }
        />
      </Suspense>
    </Card>
  );
}
type EditSpanAnnotationsProps = SpanAnnotationsEditorProps & {
  extraAnnotationCards?: React.ReactNode;
};

function EditSpanAnnotations(props: EditSpanAnnotationsProps) {
  const data = useLazyLoadQuery<SpanAnnotationsEditorQuery>(
    graphql`
      query SpanAnnotationsEditorQuery($spanId: GlobalID!) {
        span: node(id: $spanId) {
          id
          ... on Span {
            ...SpanAnnotationsEditor_spanAnnotations
          }
        }
      }
    `,
    { spanId: props.spanNodeId },
    { fetchPolicy: "store-and-network" }
  );
  return (
    <SpanAnnotationsList
      span={data.span}
      extraAnnotationCards={props.extraAnnotationCards}
    />
  );
}

function SpanAnnotationsList(props: {
  span: SpanAnnotationsEditor_spanAnnotations$key;
  extraAnnotationCards?: React.ReactNode;
}) {
  const { span, extraAnnotationCards } = props;
  const [data] = useRefetchableFragment<
    SpanAnnotationsEditorSpanAnnotationsQuery,
    SpanAnnotationsEditor_spanAnnotations$key
  >(
    graphql`
      fragment SpanAnnotationsEditor_spanAnnotations on Span
      @refetchable(queryName: "SpanAnnotationsEditorSpanAnnotationsQuery") {
        id
        spanAnnotations {
          id
          name
          annotatorKind
          score
          label
          explanation
        }
      }
    `,
    span
  );

  const annotations = data.spanAnnotations || [];
  const hasAnnotations = annotations.length > 0;
  const annotationLength = annotations.length;
  return (
    <View height="100%" maxHeight="100%" overflow="auto">
      {!hasAnnotations && !extraAnnotationCards && (
        <Empty graphicKey="documents" message="No annotations for this span" />
      )}
      <DisclosureGroup
        key={annotationLength}
        defaultExpandedKeys={[
          ...annotations.map((annotation) => annotation.id),
          "new-annotation",
        ]}
        size="S"
      >
        {annotations.map((annotation, idx) => (
          <SpanAnnotationDisclosure
            key={`${idx}_${annotation.name}`}
            annotation={annotation}
            spanNodeId={data.id}
          />
        ))}
        {extraAnnotationCards}
      </DisclosureGroup>
    </View>
  );
}

function NewSpanAnnotationDisclosure(props: {
  spanNodeId: string;
  name: string;
  onDelete: () => void;
  /**
   * Callback when the annotation is created
   */
  onCreated: () => void;
}) {
  const { spanNodeId, name, onDelete, onCreated } = props;

  return (
    <Disclosure id={`new-annotation`}>
      <DisclosureTrigger arrowPosition="start">
        <Flex
          gap="size-100"
          alignItems="center"
          width="100%"
          justifyContent="space-between"
          css={css`
            .ac-button[data-size="compact"] {
              padding: 0;
            }
          `}
        >
          {name}
          <Flex direction="row" alignItems="center" gap="size-100">
            <Button
              size="S"
              aria-label="delete annotation"
              variant="quiet"
              leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
              onPress={onDelete}
            />
          </Flex>
        </Flex>
      </DisclosureTrigger>
      <DisclosurePanel>
        <Alert variant="info" banner>
          Fill out the fields below and click save to create a new annotation.
        </Alert>
        <NewSpanAnnotationForm
          annotationName={name}
          spanNodeId={spanNodeId}
          onCreated={onCreated}
        />
      </DisclosurePanel>
    </Disclosure>
  );
}

type Annotation = NonNullable<
  SpanAnnotationsEditor_spanAnnotations$data["spanAnnotations"]
>[number];

function SpanAnnotationDisclosure(props: {
  annotation: Annotation;
  spanNodeId: string;
}) {
  const { annotation, spanNodeId } = props;
  const [error, setError] = useState<Error | null>(null);
  const notifySuccess = useNotifySuccess();

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
              }
            }
          }
        }
      }
    `);

  const handleEdit = useCallback(
    (data: AnnotationFormData) => {
      startTransition(() => {
        commitEdit({
          variables: {
            annotationId: annotation.id,
            spanId: spanNodeId,
            ...data,
          },
          onCompleted: () => {
            notifySuccess({
              title: "Annotation Updated",
              message: `Annotation ${annotation.name} has been updated.`,
            });
          },
          onError: (error) => {
            setError(error);
          },
        });
      });
    },
    [annotation.id, annotation.name, commitEdit, notifySuccess, spanNodeId]
  );
  return (
    <Disclosure id={annotation.id}>
      <DisclosureTrigger arrowPosition="start">
        <Flex
          gap="size-100"
          alignItems="center"
          width="100%"
          justifyContent="space-between"
          css={css`
            button[data-size="compact"],
            button {
              padding: 0;
            }
          `}
        >
          {annotation.name}
          <Flex direction="row" alignItems="center" gap="size-100">
            {annotation.annotatorKind === "HUMAN" && (
              <AnnotatorKindToken kind={annotation.annotatorKind} />
            )}
            <SpanAnnotationActionMenu
              annotationId={annotation.id}
              spanNodeId={spanNodeId}
              annotationName={annotation.name}
              onSpanAnnotationActionSuccess={(notifyProps) => {
                notifySuccess(notifyProps);
              }}
              onSpanAnnotationActionError={(error: Error) => {
                setError(error);
              }}
            />
          </Flex>
        </Flex>
      </DisclosureTrigger>
      <DisclosurePanel>
        {error && (
          <Alert variant="danger" banner>
            {error.message}
          </Alert>
        )}
        <SpanAnnotationForm
          initialData={annotation}
          isReadOnly={annotation.annotatorKind === "LLM"}
          isSubmitting={isCommittingEdit}
          onSubmit={(data) => {
            handleEdit(data);
          }}
        />
      </DisclosurePanel>
    </Disclosure>
  );
}

function NewAnnotationInput(props: {
  projectId: string;
  spanId: string;
  /**
   * Callback when an annotation name is selected
   * @param name The name of the annotation
   */
  onAnnotationNameSelect: (name: string) => void;
  /**
   * Callback when the popover is closed
   */
  onClose: () => void;
}) {
  const { projectId, spanId, onAnnotationNameSelect, onClose } = props;
  const data = useLazyLoadQuery<SpanAnnotationsEditorNewAnnotationQuery>(
    graphql`
      query SpanAnnotationsEditorNewAnnotationQuery(
        $projectId: GlobalID!
        $spanId: GlobalID!
      ) {
        project: node(id: $projectId) {
          id
          ... on Project {
            spanAnnotationNames
          }
        }
        span: node(id: $spanId) {
          id
          ... on Span {
            spanAnnotations {
              id
              name
              annotatorKind
            }
          }
        }
      }
    `,
    {
      projectId,
      spanId,
    }
  );

  const [newName, setNewName] = useState<string>("");
  const existingAnnotationNames = useMemo(() => {
    return (
      data?.span?.spanAnnotations?.map((annotation) => annotation.name) || []
    );
  }, [data.span.spanAnnotations]);

  const availableNames = useMemo(() => {
    const names = data.project.spanAnnotationNames || [];
    return names.filter((name) => !existingAnnotationNames.includes(name));
  }, [data.project.spanAnnotationNames, existingAnnotationNames]);
  const hasAvailableNames = availableNames.length > 0;
  return (
    <>
      <View padding="size-200">
        <Text size="S" weight="heavy">
          New Annotation
        </Text>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            onAnnotationNameSelect(newName);
            onClose();
          }}
        >
          <Flex direction="row" gap="size-100" alignItems="end">
            <TextField
              autoFocus
              value={newName}
              onChange={(newName) => {
                setNewName(newName);
              }}
              name="new-annotation-name"
            >
              <Label>Annotation Name</Label>
              <Input placeholder="e.x. correctness" />
            </TextField>
            <Button variant="primary" type="submit">
              Create
            </Button>
          </Flex>
        </Form>
      </View>
      {hasAvailableNames && (
        <>
          <View
            borderTopWidth="thin"
            borderBottomWidth="thin"
            borderColor="light"
            paddingStart="size-200"
            paddingTop="size-100"
            paddingBottom="size-100"
            backgroundColor="grey-300"
          >
            <label>select from existing</label>
          </View>
          <ListBox
            selectionMode="single"
            onSelectionChange={(keys) => {
              // Single select so we can just use the first key
              if (keys === "all" || keys.size === 0) {
                return;
              }
              const nameKey = keys.values().next().value;
              const name = nameKey as string;
              setNewName(name || "");
            }}
            disabledKeys={existingAnnotationNames}
          >
            {availableNames.map((name) => (
              <ListBoxItem key={name}>{name}</ListBoxItem>
            ))}
          </ListBox>
        </>
      )}
    </>
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
