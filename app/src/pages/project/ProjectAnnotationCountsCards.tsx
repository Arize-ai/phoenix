import { css } from "@emotion/react";
import { getLocalTimeZone, now } from "@internationalized/date";
import { Suspense, useState } from "react";
import { Form } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import type { DateValue } from "@phoenix/components";
import {
  Button,
  Card,
  ContentSkeleton,
  DateField,
  DateInput,
  DateSegment,
  Dialog,
  DialogTrigger,
  Empty,
  FieldError,
  Flex,
  Icon,
  Icons,
  Label,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
  Switch,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { tableCSS } from "@phoenix/components/table/styles";
import {
  useNotifyError,
  useNotifySuccess,
  useViewerCanDeleteProjectAnnotations,
} from "@phoenix/contexts";

import type {
  AnnotationTimeRangeField,
  ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation,
} from "./__generated__/ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation.graphql";
import type { ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation } from "./__generated__/ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation.graphql";
import type { ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation } from "./__generated__/ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation.graphql";
import type { ProjectAnnotationCountsCardsQuery } from "./__generated__/ProjectAnnotationCountsCardsQuery.graphql";

interface ProjectAnnotationCountsCardsProps {
  projectId: string;
}

interface AnnotationNameCount {
  readonly name: string;
  readonly count: number;
}

/**
 * Performs the bulk delete for a single annotation level (span, trace, or
 * session). The level-specific Relay mutation is bound by the parent.
 */
type DeleteAnnotationsFn = (args: {
  annotationName: string;
  timeRange: { start: string | null; end: string | null } | null;
  timeRangeField: AnnotationTimeRangeField;
  onCompleted: (deletedCount: number) => void;
  onError: (message: string) => void;
}) => void;

const LEVELS = [
  {
    title: "Span Annotations",
    // The noun used when describing the source's activity time in the UI.
    sourceNoun: "span",
    emptyMessage: "No span annotations have been added to this project.",
  },
  {
    title: "Trace Annotations",
    sourceNoun: "trace",
    emptyMessage: "No trace annotations have been added to this project.",
  },
  {
    title: "Session Annotations",
    sourceNoun: "session",
    emptyMessage: "No session annotations have been added to this project.",
  },
] as const;

/**
 * A set of cards summarizing which annotations have been added to a project at
 * the span, trace, and session levels, along with the number of annotations
 * recorded for each annotation name. Admins can bulk-delete all annotations of a
 * given name, optionally restricted to a time range.
 */
export const ProjectAnnotationCountsCards = (
  props: ProjectAnnotationCountsCardsProps
) => {
  return (
    <Suspense fallback={<ProjectAnnotationCountsCardsFallback />}>
      <ProjectAnnotationCountsCardsContent projectId={props.projectId} />
    </Suspense>
  );
};

const ProjectAnnotationCountsCardsFallback = () => {
  return (
    <>
      {LEVELS.map((level) => (
        <Card key={level.title} title={level.title}>
          <ContentSkeleton />
        </Card>
      ))}
    </>
  );
};

const ProjectAnnotationCountsCardsContent = (
  props: ProjectAnnotationCountsCardsProps
) => {
  const { projectId } = props;
  // Mirrors the backend's IsAdminIfAuthEnabled gate: admins, or anyone when auth
  // is disabled.
  const canDelete = useViewerCanDeleteProjectAnnotations();

  const data = useLazyLoadQuery<ProjectAnnotationCountsCardsQuery>(
    graphql`
      query ProjectAnnotationCountsCardsQuery($projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            spanAnnotationNameCounts {
              name
              count
            }
            traceAnnotationNameCounts {
              name
              count
            }
            sessionAnnotationNameCounts {
              name
              count
            }
          }
        }
      }
    `,
    { projectId }
  );

  const [commitDeleteSpan, isDeletingSpan] =
    useMutation<ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation>(graphql`
      mutation ProjectAnnotationCountsCardsDeleteSpanAnnotationsMutation(
        $projectId: ID!
        $input: DeleteProjectAnnotationsInput!
      ) {
        deleteProjectSpanAnnotations(input: $input) {
          deletedAnnotationCount
          query {
            node(id: $projectId) {
              ... on Project {
                spanAnnotationNameCounts {
                  name
                  count
                }
              }
            }
          }
        }
      }
    `);

  const [commitDeleteTrace, isDeletingTrace] =
    useMutation<ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation>(graphql`
      mutation ProjectAnnotationCountsCardsDeleteTraceAnnotationsMutation(
        $projectId: ID!
        $input: DeleteProjectAnnotationsInput!
      ) {
        deleteProjectTraceAnnotations(input: $input) {
          deletedAnnotationCount
          query {
            node(id: $projectId) {
              ... on Project {
                traceAnnotationNameCounts {
                  name
                  count
                }
              }
            }
          }
        }
      }
    `);

  const [commitDeleteSession, isDeletingSession] =
    useMutation<ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation>(graphql`
      mutation ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation(
        $projectId: ID!
        $input: DeleteProjectAnnotationsInput!
      ) {
        deleteProjectSessionAnnotations(input: $input) {
          deletedAnnotationCount
          query {
            node(id: $projectId) {
              ... on Project {
                sessionAnnotationNameCounts {
                  name
                  count
                }
              }
            }
          }
        }
      }
    `);

  // The level-specific mutations share an identical variables shape; only the
  // bound commit fn and the response field they read the count from differ.
  const toVariables = (args: Parameters<DeleteAnnotationsFn>[0]) => ({
    projectId,
    input: {
      projectId,
      annotationName: args.annotationName,
      timeRange: args.timeRange ?? undefined,
      timeRangeField: args.timeRangeField,
    },
  });

  const deleteSpan: DeleteAnnotationsFn = (args) =>
    commitDeleteSpan({
      variables: toVariables(args),
      onCompleted: (response) =>
        args.onCompleted(
          response.deleteProjectSpanAnnotations.deletedAnnotationCount
        ),
      onError: (error) => args.onError(error.message),
    });

  const deleteTrace: DeleteAnnotationsFn = (args) =>
    commitDeleteTrace({
      variables: toVariables(args),
      onCompleted: (response) =>
        args.onCompleted(
          response.deleteProjectTraceAnnotations.deletedAnnotationCount
        ),
      onError: (error) => args.onError(error.message),
    });

  const deleteSession: DeleteAnnotationsFn = (args) =>
    commitDeleteSession({
      variables: toVariables(args),
      onCompleted: (response) =>
        args.onCompleted(
          response.deleteProjectSessionAnnotations.deletedAnnotationCount
        ),
      onError: (error) => args.onError(error.message),
    });

  const levels = [
    {
      ...LEVELS[0],
      annotations: data.project.spanAnnotationNameCounts ?? [],
      onDelete: deleteSpan,
      isDeleting: isDeletingSpan,
    },
    {
      ...LEVELS[1],
      annotations: data.project.traceAnnotationNameCounts ?? [],
      onDelete: deleteTrace,
      isDeleting: isDeletingTrace,
    },
    {
      ...LEVELS[2],
      annotations: data.project.sessionAnnotationNameCounts ?? [],
      onDelete: deleteSession,
      isDeleting: isDeletingSession,
    },
  ];

  return (
    <>
      {levels.map((level) => (
        <AnnotationCountsCard
          key={level.title}
          title={level.title}
          sourceNoun={level.sourceNoun}
          emptyMessage={level.emptyMessage}
          annotations={level.annotations}
          canDelete={canDelete}
          isDeleting={level.isDeleting}
          onDelete={level.onDelete}
        />
      ))}
    </>
  );
};

const totalCountCSS = css`
  color: var(--ac-global-text-color-700);
`;

const countCellCSS = css`
  text-align: right;
  width: 100px;
`;

const actionCellCSS = css`
  text-align: right;
  width: 48px;
`;

interface AnnotationCountsCardProps {
  title: string;
  sourceNoun: string;
  emptyMessage: string;
  annotations: readonly AnnotationNameCount[];
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: DeleteAnnotationsFn;
}

const AnnotationCountsCard = (props: AnnotationCountsCardProps) => {
  const {
    title,
    sourceNoun,
    emptyMessage,
    annotations,
    canDelete,
    isDeleting,
    onDelete,
  } = props;
  // Sort by count descending, then name ascending, to surface the most
  // heavily annotated names first.
  const sortedAnnotations = [...annotations].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );
  const totalCount = annotations.reduce(
    (total, annotation) => total + annotation.count,
    0
  );

  return (
    <Card
      title={title}
      extra={
        <Text css={totalCountCSS} size="S">
          {totalCount.toLocaleString()} total
        </Text>
      }
    >
      {sortedAnnotations.length === 0 ? (
        <View paddingY="size-400">
          <Empty message={emptyMessage} />
        </View>
      ) : (
        <div
          css={css`
            overflow: auto;
          `}
        >
          <table css={tableCSS}>
            <thead>
              <tr>
                <th>Name</th>
                <th css={countCellCSS}>Count</th>
                {canDelete ? <th css={actionCellCSS} /> : null}
              </tr>
            </thead>
            <tbody>
              {sortedAnnotations.map((annotation) => (
                <tr key={annotation.name}>
                  <td>
                    <AnnotationLabel
                      annotation={{ name: annotation.name }}
                      annotationDisplayPreference="none"
                      css={css`
                        width: fit-content;
                      `}
                    />
                  </td>
                  <td css={countCellCSS}>
                    <Text>{annotation.count.toLocaleString()}</Text>
                  </td>
                  {canDelete ? (
                    <td css={actionCellCSS}>
                      <DeleteAnnotationsButton
                        annotationName={annotation.name}
                        sourceNoun={sourceNoun}
                        isDeleting={isDeleting}
                        onDelete={onDelete}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

interface DeleteAnnotationsButtonProps {
  annotationName: string;
  sourceNoun: string;
  isDeleting: boolean;
  onDelete: DeleteAnnotationsFn;
}

const DeleteAnnotationsButton = (props: DeleteAnnotationsButtonProps) => {
  return (
    <DialogTrigger>
      <Button
        size="S"
        variant="quiet"
        aria-label={`Delete all "${props.annotationName}" annotations`}
        leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
      />
      <ModalOverlay>
        <Modal size="S">
          <Dialog>
            {({ close }) => (
              <DeleteAnnotationsDialog
                annotationName={props.annotationName}
                sourceNoun={props.sourceNoun}
                isDeleting={props.isDeleting}
                onDelete={props.onDelete}
                close={close}
              />
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
};

const dateFieldCSS = css`
  .react-aria-DateInput {
    width: 100%;
  }
`;

interface DeleteAnnotationsDialogProps {
  annotationName: string;
  sourceNoun: string;
  isDeleting: boolean;
  onDelete: DeleteAnnotationsFn;
  close: () => void;
}

const DeleteAnnotationsDialog = (props: DeleteAnnotationsDialogProps) => {
  const { annotationName, sourceNoun, isDeleting, onDelete, close } = props;
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const [limitToTimeRange, setLimitToTimeRange] = useState(false);
  // Pre-fill a concrete, valid range (the last 7 days) so the date segments are
  // easy to adjust rather than starting from empty placeholders.
  const [startDate, setStartDate] = useState<DateValue | null>(() =>
    now(getLocalTimeZone()).subtract({ days: 7 })
  );
  const [endDate, setEndDate] = useState<DateValue | null>(() =>
    now(getLocalTimeZone())
  );
  const [timeRangeField, setTimeRangeField] =
    useState<AnnotationTimeRangeField>("ANNOTATION_CREATED_AT");
  const [endError, setEndError] = useState<string | null>(null);

  const handleDelete = () => {
    setEndError(null);
    const timeZone = getLocalTimeZone();
    let timeRange: { start: string | null; end: string | null } | null = null;
    if (limitToTimeRange && (startDate || endDate)) {
      const start = startDate ? startDate.toDate(timeZone) : null;
      const end = endDate ? endDate.toDate(timeZone) : null;
      if (start && end && end <= start) {
        setEndError("End must be after the start.");
        return;
      }
      timeRange = {
        start: start ? start.toISOString() : null,
        end: end ? end.toISOString() : null,
      };
    }
    onDelete({
      annotationName,
      timeRange,
      timeRangeField: limitToTimeRange
        ? timeRangeField
        : "ANNOTATION_CREATED_AT",
      onCompleted: (deletedCount) => {
        notifySuccess({
          title: "Annotations deleted",
          message: `Deleted ${deletedCount.toLocaleString()} "${annotationName}" annotation${
            deletedCount === 1 ? "" : "s"
          }.`,
        });
        close();
      },
      onError: (message) => {
        notifyError({
          title: "Failed to delete annotations",
          message,
        });
      },
    });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete {annotationName} annotations</DialogTitle>
        <DialogTitleExtra>
          <DialogCloseButton slot="close" />
        </DialogTitleExtra>
      </DialogHeader>
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          handleDelete();
        }}
      >
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <Text>
              {limitToTimeRange
                ? `This permanently deletes the "${annotationName}" annotations in the selected time range. This cannot be undone.`
                : `This permanently deletes all "${annotationName}" annotations in this project. This cannot be undone.`}
            </Text>
            <Switch
              isSelected={limitToTimeRange}
              onChange={setLimitToTimeRange}
              labelPlacement="end"
            >
              Only delete within a time range
            </Switch>
            {limitToTimeRange ? (
              <Flex direction="column" gap="size-200">
                <DateField
                  value={startDate}
                  onChange={setStartDate}
                  granularity="minute"
                  hideTimeZone
                  css={dateFieldCSS}
                >
                  <Label>Start</Label>
                  <DateInput>
                    {(segment) => <DateSegment segment={segment} />}
                  </DateInput>
                  <Text slot="description">
                    Inclusive. Leave empty for no lower bound.
                  </Text>
                </DateField>
                <DateField
                  value={endDate}
                  onChange={(value) => {
                    setEndDate(value);
                    setEndError(null);
                  }}
                  isInvalid={endError != null}
                  granularity="minute"
                  hideTimeZone
                  css={dateFieldCSS}
                >
                  <Label>End</Label>
                  <DateInput>
                    {(segment) => <DateSegment segment={segment} />}
                  </DateInput>
                  {endError ? (
                    <FieldError>{endError}</FieldError>
                  ) : (
                    <Text slot="description">
                      Exclusive. Leave empty for no upper bound.
                    </Text>
                  )}
                </DateField>
                <RadioGroup
                  value={timeRangeField}
                  onChange={(value) =>
                    setTimeRangeField(value as AnnotationTimeRangeField)
                  }
                  direction="column"
                >
                  <Label>Filter on</Label>
                  <Radio value="ANNOTATION_CREATED_AT">
                    When the annotation was created
                  </Radio>
                  <Radio value="SOURCE_START_TIME">
                    When the {sourceNoun} started
                  </Radio>
                </RadioGroup>
              </Flex>
            ) : null}
          </Flex>
        </View>
        <View
          paddingStart="size-200"
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderColor="default"
          borderTopWidth="thin"
        >
          <Flex direction="row" gap="size-100" justifyContent="end">
            <Button size="S" onPress={close} isDisabled={isDeleting}>
              Cancel
            </Button>
            <Button
              size="S"
              variant="danger"
              type="submit"
              isDisabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete annotations"}
            </Button>
          </Flex>
        </View>
      </Form>
    </DialogContent>
  );
};
