import { css } from "@emotion/react";
import { getLocalTimeZone, now } from "@internationalized/date";
import { Suspense, useState } from "react";
import { Form } from "react-aria-components";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";

import type { DateValue } from "@phoenix/components";
import {
  Alert,
  Button,
  Card,
  ContentSkeleton,
  Counter,
  DateField,
  DateInput,
  DateSegment,
  Dialog,
  DialogTrigger,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { tableCSS } from "@phoenix/components/table/styles";
import {
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

const sumCounts = (annotations: readonly AnnotationNameCount[]) =>
  annotations.reduce((total, annotation) => total + annotation.count, 0);

/**
 * Performs the bulk delete for a single annotation target type (span, trace,
 * or session). The target-type-specific Relay mutation is bound by the parent.
 */
type DeleteAnnotationsFn = (args: {
  annotationName: string;
  timeRange: { start: string | null; end: string | null } | null;
  timeRangeField: AnnotationTimeRangeField;
  onCompleted: (deletedCount: number) => void;
  onError: (message: string) => void;
}) => void;

// The annotation target type is what an annotation is attached to: a span,
// trace, or session.
const TARGET_TYPES = [
  {
    title: "Span Annotations",
    // The noun used when describing the source's activity time in the UI.
    sourceNoun: "span",
  },
  {
    title: "Trace Annotations",
    sourceNoun: "trace",
  },
  {
    title: "Session Annotations",
    sourceNoun: "session",
  },
] as const;

/**
 * A single card summarizing which annotations have been added to a project,
 * with a collapsible section per target type (span, trace, and session) listing
 * the number of annotations recorded for each annotation name. Sections are
 * collapsed by default to keep the configuration page dense. Admins can
 * bulk-delete all annotations of a given name, optionally restricted to a time
 * range.
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
    <Card title="Annotations">
      <ContentSkeleton />
    </Card>
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

  // The target-type-specific mutations share an identical variables shape; only the
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

  const [spanTargetType, traceTargetType, sessionTargetType] = TARGET_TYPES;
  const targetTypes = [
    {
      ...spanTargetType,
      annotations: data.project.spanAnnotationNameCounts ?? [],
      onDelete: deleteSpan,
      isDeleting: isDeletingSpan,
    },
    {
      ...traceTargetType,
      annotations: data.project.traceAnnotationNameCounts ?? [],
      onDelete: deleteTrace,
      isDeleting: isDeletingTrace,
    },
    {
      ...sessionTargetType,
      annotations: data.project.sessionAnnotationNameCounts ?? [],
      onDelete: deleteSession,
      isDeleting: isDeletingSession,
    },
  ];

  const grandTotal = targetTypes.reduce(
    (total, targetType) => total + sumCounts(targetType.annotations),
    0
  );

  return (
    <Card
      title="Annotations"
      extra={
        <Text css={totalCountCSS} size="S">
          {grandTotal.toLocaleString()} total
        </Text>
      }
    >
      <DisclosureGroup>
        {targetTypes.map((targetType) => (
          <AnnotationCountsSection
            key={targetType.title}
            id={targetType.title}
            title={targetType.title}
            sourceNoun={targetType.sourceNoun}
            annotations={targetType.annotations}
            canDelete={canDelete}
            isDeleting={targetType.isDeleting}
            onDelete={targetType.onDelete}
          />
        ))}
      </DisclosureGroup>
    </Card>
  );
};

const totalCountCSS = css`
  color: var(--global-text-color-700);
`;

const countCellCSS = css`
  text-align: right;
  width: 100px;
`;

const actionCellCSS = css`
  text-align: right;
  width: 48px;
`;

interface AnnotationCountsSectionProps {
  id: string;
  title: string;
  sourceNoun: string;
  annotations: readonly AnnotationNameCount[];
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: DeleteAnnotationsFn;
}

const AnnotationCountsSection = (props: AnnotationCountsSectionProps) => {
  const {
    id,
    title,
    sourceNoun,
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
  const totalCount = sumCounts(annotations);
  const isEmpty = sortedAnnotations.length === 0;

  return (
    // Collapse every section by default, and disable the ones with no
    // annotations so the trigger reads as "nothing to expand".
    <Disclosure id={id} defaultExpanded={false} isDisabled={isEmpty}>
      <DisclosureTrigger arrowPosition="start" justifyContent="space-between">
        <Flex direction="row" gap="size-100" alignItems="center">
          <Text>{title}</Text>
          <Counter variant={isEmpty ? "quiet" : "default"}>
            {sortedAnnotations.length}
          </Counter>
        </Flex>
        <Text css={totalCountCSS} size="S">
          {totalCount.toLocaleString()} total
        </Text>
      </DisclosureTrigger>
      <DisclosurePanel>
        <div
          css={css`
            overflow-x: auto;
          `}
        >
          <table css={tableCSS} aria-label={`${title} by name`}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" css={countCellCSS}>
                  Count
                </th>
                {canDelete ? (
                  <th scope="col" css={actionCellCSS} aria-label="Actions" />
                ) : null}
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
      </DisclosurePanel>
    </Disclosure>
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
        aria-label={`Delete all ${props.sourceNoun} annotations named "${props.annotationName}"`}
        isDisabled={props.isDeleting}
        leadingVisual={<Icon svg={<Icons.Trash />} />}
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
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = () => {
    setEndError(null);
    setDeleteError(null);
    const timeZone = getLocalTimeZone();
    let timeRange: { start: string | null; end: string | null } | null = null;
    if (limitToTimeRange) {
      if (!startDate && !endDate) {
        setDeleteError(
          "Select a start date, an end date, or turn off the time range limit."
        );
        return;
      }
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
        setDeleteError(message);
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
      {deleteError ? (
        <View paddingX="size-200" paddingTop="size-100">
          <Alert variant="danger" banner>
            {deleteError}
          </Alert>
        </View>
      ) : null}
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
              onChange={(isSelected) => {
                setLimitToTimeRange(isSelected);
                setDeleteError(null);
                setEndError(null);
              }}
              labelPlacement="end"
            >
              Only delete within a time range
            </Switch>
            {limitToTimeRange ? (
              <Flex direction="column" gap="size-200">
                <DateField
                  value={startDate}
                  onChange={(value) => {
                    setStartDate(value);
                    setDeleteError(null);
                    setEndError(null);
                  }}
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
                    setDeleteError(null);
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
                  onChange={(value) => {
                    setTimeRangeField(value as AnnotationTimeRangeField);
                    setDeleteError(null);
                  }}
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
        <DialogFooter>
          <Button
            size="S"
            onPress={close}
            isDisabled={isDeleting}
            type="button"
          >
            Cancel
          </Button>
          <Button
            size="S"
            variant="danger"
            type="submit"
            isDisabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete annotations"}
          </Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  );
};
