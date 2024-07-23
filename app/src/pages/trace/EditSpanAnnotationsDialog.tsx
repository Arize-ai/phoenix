import React, { Suspense, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Alert,
  Button,
  Card,
  Dialog,
  Flex,
  Icon,
  Icons,
  Item,
  Label,
  ListBox,
  PopoverTrigger,
  TextField,
  View,
} from "@arizeai/components";

import { Empty } from "@phoenix/components/Empty";
import { useNotifySuccess } from "@phoenix/contexts";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { EditSpanAnnotationsDialogNewAnnotationQuery } from "./__generated__/EditSpanAnnotationsDialogNewAnnotationQuery.graphql";
import {
  AnnotatorKind,
  EditSpanAnnotationsDialogQuery,
  EditSpanAnnotationsDialogQuery$data,
} from "./__generated__/EditSpanAnnotationsDialogQuery.graphql";
import { NewSpanAnnotationForm } from "./NewSpanAnnotationForm";
import { SpanAnnotationActionMenu } from "./SpanAnnotationActionMenu";
import { SpanAnnotationForm } from "./SpanAnnotationForm";

type EditSpanAnnotationsDialogProps = {
  spanNodeId: string;
  projectId: string;
};
export function EditSpanAnnotationsDialog(
  props: EditSpanAnnotationsDialogProps
) {
  const { projectId, spanNodeId } = props;
  const [newAnnotationName, setNewAnnotationName] = useState<string | null>(
    null
  );
  const [fetchKey, setFetchKey] = useState(0);
  const notifySuccess = useNotifySuccess();
  return (
    <Dialog
      title="Annotate"
      size="M"
      isDismissable
      extra={
        <NewAnnotationButton
          projectId={projectId}
          spanNodeId={spanNodeId}
          disabled={newAnnotationName !== null}
          onAnnotationNameSelect={setNewAnnotationName}
        />
      }
    >
      <div
        css={css`
          height: 100%;
          overflow-y: auto;
          padding: var(--ac-global-dimension-size-200);
        `}
      >
        {newAnnotationName && (
          <View paddingBottom="size-200">
            <NewSpanAnnotationCard
              spanNodeId={spanNodeId}
              name={newAnnotationName}
              onDelete={() => {
                setNewAnnotationName(null);
              }}
              onCreated={() => {
                setNewAnnotationName(null);
                setFetchKey((key) => key + 1);
                notifySuccess({
                  title: `New Span Annotation`,
                  message: `Annotation ${newAnnotationName} has been created.`,
                });
              }}
            />
          </View>
        )}
        <Suspense>
          <EditSpanAnnotations {...props} fetchKey={fetchKey} />
        </Suspense>
      </div>
    </Dialog>
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
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  return (
    <PopoverTrigger
      placement="bottom end"
      crossOffset={300}
      isOpen={isPopoverOpen}
      onOpenChange={(isOpen) => {
        setIsPopoverOpen(isOpen);
      }}
    >
      <Button
        variant="default"
        disabled={disabled}
        size="compact"
        icon={<Icon svg={<Icons.PlusCircleOutline />} />}
        onClick={() => {
          setIsPopoverOpen(true);
        }}
      >
        New
      </Button>
      <NewAnnotationPopover
        projectId={projectId}
        spanNodeId={spanNodeId}
        onAnnotationNameSelect={(name) => {
          onAnnotationNameSelect(name);
          setIsPopoverOpen(false);
        }}
      />
    </PopoverTrigger>
  );
}

type NewAnnotationPopoverProps = {
  projectId: string;
  spanNodeId: string;
  onAnnotationNameSelect: (name: string) => void;
};

function NewAnnotationPopover(props: NewAnnotationPopoverProps) {
  const { projectId, spanNodeId, onAnnotationNameSelect } = props;
  return (
    <Card
      title="New Annotation"
      backgroundColor="light"
      borderColor="light"
      variant="compact"
      bodyStyle={{ padding: 0 }}
    >
      <Suspense>
        <NewAnnotationPopoverContent
          projectId={projectId}
          spanId={spanNodeId}
          onAnnotationNameSelect={onAnnotationNameSelect}
        />
      </Suspense>
    </Card>
  );
}
type EditSpanAnnotationsProps = EditSpanAnnotationsDialogProps & {
  /**
   * Key used to force a refetch of the annotations
   */
  fetchKey: number;
};
function EditSpanAnnotations(props: EditSpanAnnotationsProps) {
  const { fetchKey } = props;
  const data = useLazyLoadQuery<EditSpanAnnotationsDialogQuery>(
    graphql`
      query EditSpanAnnotationsDialogQuery($spanId: GlobalID!) {
        span: node(id: $spanId) {
          id
          ... on Span {
            spanAnnotations {
              id
              name
              annotatorKind
              score
              label
              explanation
            }
          }
        }
      }
    `,
    { spanId: props.spanNodeId },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const annotations = data.span.spanAnnotations || [];
  const hasAnnotations = annotations.length > 0;
  return (
    <div>
      {!hasAnnotations && (
        <Empty graphicKey="documents" message="No annotations for this span" />
      )}
      <ul
        css={css`
          display: flex;
          flex-direction: column;
          gap: var(--ac-global-dimension-size-200);
        `}
      >
        {annotations.map((annotation, idx) => (
          <li key={idx}>
            <SpanAnnotationCard annotation={annotation} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewSpanAnnotationCard(props: {
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
    <Card
      variant="compact"
      title={name}
      extra={
        <Flex direction="row" alignItems="center" gap="size-100">
          <AnnotatorKindLabel kind="HUMAN" />
          <Button
            variant="default"
            size="compact"
            isDisabled
            aria-label="delete annotation"
            icon={<Icon svg={<Icons.CloseOutline />} />}
            onClick={onDelete}
          />
        </Flex>
      }
      bodyStyle={{ padding: 0 }}
    >
      <Alert variant="info" banner>
        Fill out the fields below and click save to create a new annotation.
      </Alert>
      <NewSpanAnnotationForm
        annotationName={name}
        spanNodeId={spanNodeId}
        onCreated={onCreated}
      />
    </Card>
  );
}

type Annotation = NonNullable<
  EditSpanAnnotationsDialogQuery$data["span"]["spanAnnotations"]
>[number];

function SpanAnnotationCard(props: { annotation: Annotation }) {
  const { annotation } = props;
  const [error, setError] = useState<Error | null>(null);
  const notifySuccess = useNotifySuccess();
  return (
    <Card
      variant="compact"
      title={annotation.name}
      titleExtra={
        annotation.label ||
        (typeof annotation.score == "number" &&
          formatFloat(annotation.score)) ||
        null
      }
      collapsible
      bodyStyle={{ padding: 0 }}
      extra={
        <Flex gap="size-100" alignItems="center">
          <AnnotatorKindLabel kind={annotation.annotatorKind} />
          <SpanAnnotationActionMenu
            annotationId={annotation.id}
            annotationName={annotation.name}
            onSpanAnnotationDelete={() => {
              notifySuccess({
                title: `Annotation Deleted`,
                message: `Annotation ${annotation.name} has been deleted.`,
              });
            }}
            onSpanAnnotationDeleteError={(error: Error) => {
              setError(error);
            }}
          />
        </Flex>
      }
    >
      {error && (
        <Alert variant="danger" banner>
          {error.message}
        </Alert>
      )}
      {/* TODO make it editable */}
      <SpanAnnotationForm initialData={annotation} isReadOnly={true} />
    </Card>
  );
}

function AnnotatorKindLabel(props: { kind: AnnotatorKind }) {
  const { kind } = props;
  return (
    <Label color={kind === "HUMAN" ? "blue-900" : "orange-900"}>{kind}</Label>
  );
}

function NewAnnotationPopoverContent(props: {
  projectId: string;
  spanId: string;
  /**
   * Callback when an annotation name is selected
   * @param name The name of the annotation
   */
  onAnnotationNameSelect: (name: string) => void;
}) {
  const { projectId, spanId, onAnnotationNameSelect } = props;
  const data = useLazyLoadQuery<EditSpanAnnotationsDialogNewAnnotationQuery>(
    graphql`
      query EditSpanAnnotationsDialogNewAnnotationQuery(
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

  // Use deferred?
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
        <Flex direction="row" gap="size-100" alignItems="end">
          <TextField
            label="Annotation Name"
            value={newName}
            placeholder="e.x. correctness"
            onChange={(newName) => {
              setNewName(newName);
            }}
          />
          <Button
            variant="primary"
            onClick={() => {
              onAnnotationNameSelect(newName);
            }}
          >
            Create
          </Button>
        </Flex>
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
              const name = keys.entries().next().value[0];
              setNewName(name);
            }}
            disabledKeys={existingAnnotationNames}
          >
            {availableNames.map((name) => (
              <Item key={name}>{name}</Item>
            ))}
          </ListBox>
        </>
      )}
    </>
  );
}
