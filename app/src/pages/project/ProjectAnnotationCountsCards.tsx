import { css } from "@emotion/react";
import { getLocalTimeZone } from "@internationalized/date";
import { Suspense, useState } from "react";
import type { DateValue } from "react-aria-components";
import { DateInput, DateSegment, Label } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import {
  Button,
  Card,
  ContentSkeleton,
  DateField,
  Dialog,
  DialogTrigger,
  Empty,
  Flex,
  Icon,
  Icons,
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
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";
import { tableCSS } from "@phoenix/components/table/styles";
import { useNotifyError, useNotifySuccess, useViewer } from "@phoenix/contexts";

import type { ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation } from "./__generated__/ProjectAnnotationCountsCardsDeleteSessionAnnotationsMutation.graphql";
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

type AnnotationTimeRangeField = "ANNOTATION_CREATED_AT" | "SOURCE_START_TIME";

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
  const { viewer } = useViewer();
  // Mirror the backend's IsAdminIfAuthEnabled gate: when auth is disabled (no
  // viewer) anyone can delete; otherwise only admins can.
  const canDelete = !viewer || viewer.role.name === "ADMIN";

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

  const deleteSpan: DeleteAnnotationsFn = (args) =>
    commitDeleteSpan({
      variables: {
        projectId,
        input: {
          projectId,
          annotationName: args.annotationName,
          timeRange: args.timeRange ?? undefined,
          timeRangeField: args.timeRangeField,
        },
      },
      onCompleted: (response) =>
        args.onCompleted(
          response.deleteProjectSpanAnnotations.deletedAnnotationCount
        ),
      onError: (error) => args.onError(error.message),
    });

  const deleteTrace: DeleteAnnotationsFn = (args) =>
    commitDeleteTrace({
      variables: {
        projectId,
        input: {
          projectId,
          annotationName: args.annotationName,
          timeRange: args.timeRange ?? undefined,
          timeRangeField: args.timeRangeField,
        },
      },
      onCompleted: (response) =>
        args.onCompleted(
          response.deleteProjectTraceAnnotations.deletedAnnotationCount
        ),
      onError: (error) => args.onError(error.message),
    });

  const deleteSession: DeleteAnnotationsFn = (args) =>
    commitDeleteSession({
      variables: {
        projectId,
        input: {
          projectId,
          annotationName: args.annotationName,
          timeRange: args.timeRange ?? undefined,
          timeRangeField: args.timeRangeField,
        },
      },
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
        <Modal size="M">
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

const dialogBodyCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-200);
`;

const dateFieldsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-100);
  .react-aria-DateInput {
    min-width: 220px;
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
  const [startDate, setStartDate] = useState<DateValue | null>(null);
  const [endDate, setEndDate] = useState<DateValue | null>(null);
  const [timeRangeField, setTimeRangeField] =
    useState<AnnotationTimeRangeField>("ANNOTATION_CREATED_AT");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = () => {
    setErrorMessage(null);
    const timeZone = getLocalTimeZone();
    let timeRange: { start: string | null; end: string | null } | null = null;
    if (limitToTimeRange && (startDate || endDate)) {
      const start = startDate ? startDate.toDate(timeZone) : null;
      const end = endDate ? endDate.toDate(timeZone) : null;
      if (start && end && start >= end) {
        setErrorMessage("The end of the time range must be after the start.");
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
      timeRangeField,
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
        <DialogTitle>
          Delete &ldquo;{annotationName}&rdquo; annotations
        </DialogTitle>
      </DialogHeader>
      <View padding="size-200">
        <div css={dialogBodyCSS}>
          <Text color="danger">
            {limitToTimeRange
              ? `This will permanently delete the "${annotationName}" annotations within the selected time range. This cannot be undone.`
              : `This will permanently delete all "${annotationName}" annotations in this project. This cannot be undone.`}
          </Text>
          <Switch
            isSelected={limitToTimeRange}
            onChange={setLimitToTimeRange}
            labelPlacement="end"
          >
            Only delete annotations within a time range
          </Switch>
          {limitToTimeRange ? (
            <div css={dateFieldsCSS}>
              <DateField
                value={startDate}
                onChange={setStartDate}
                granularity="second"
                hideTimeZone
              >
                <Label>Start (inclusive)</Label>
                <DateInput>
                  {(segment) => <DateSegment segment={segment} />}
                </DateInput>
              </DateField>
              <DateField
                value={endDate}
                onChange={setEndDate}
                granularity="second"
                hideTimeZone
              >
                <Label>End (exclusive)</Label>
                <DateInput>
                  {(segment) => <DateSegment segment={segment} />}
                </DateInput>
              </DateField>
              <RadioGroup
                direction="column"
                value={timeRangeField}
                onChange={(value) =>
                  setTimeRangeField(value as AnnotationTimeRangeField)
                }
                aria-label="Filter the time range by"
              >
                <Radio value="ANNOTATION_CREATED_AT">
                  When the annotation was created
                </Radio>
                <Radio value="SOURCE_START_TIME">
                  When the {sourceNoun} started
                </Radio>
              </RadioGroup>
              <Text size="XS" color="text-700">
                Leave either field empty for an open-ended range.
              </Text>
            </div>
          ) : null}
          {errorMessage ? <Text color="danger">{errorMessage}</Text> : null}
        </div>
      </View>
      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderTopColor="default"
        borderTopWidth="thin"
      >
        <Flex direction="row" justifyContent="end" gap="size-200">
          <Button onPress={close} isDisabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isDisabled={isDeleting}
            onPress={handleDelete}
          >
            {isDeleting ? "Deleting…" : "Delete annotations"}
          </Button>
        </Flex>
      </View>
    </DialogContent>
  );
};
