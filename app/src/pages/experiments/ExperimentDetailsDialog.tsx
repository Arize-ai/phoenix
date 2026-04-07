import { css } from "@emotion/react";
import { formatDistance } from "date-fns";
import {
  startTransition,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { useParams } from "react-router";

import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitleExtra,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Heading,
  LinkButton,
  Text,
  TitleWithID,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { CopyToClipboardButton } from "@phoenix/components/core/copy";
import { Skeleton } from "@phoenix/components/core/loading";
import { LoadMoreButton } from "@phoenix/components/core/LoadMoreButton";
import {
  ExperimentStatus,
  SequenceNumberToken,
} from "@phoenix/components/experiment";
import { tableCSS } from "@phoenix/components/table/styles";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useViewer } from "@phoenix/contexts";
import { useTimeFormatters } from "@phoenix/hooks";
import {
  formatCost,
  formatPercent,
  intFormatter,
} from "@phoenix/utils/numberFormatUtils";

import type {
  ExperimentDetailsDialog_jobErrors$data,
  ExperimentDetailsDialog_jobErrors$key,
} from "./__generated__/ExperimentDetailsDialog_jobErrors.graphql";
import type { ExperimentDetailsDialogQuery } from "./__generated__/ExperimentDetailsDialogQuery.graphql";

function ExperimentDetailsDialogSkeleton() {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <Skeleton height={24} width={200} />
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Flex direction="column" gap="size-200">
            <Skeleton height={100} />
            <Skeleton height={100} />
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}

export function ExperimentDetailsDialog({
  experimentId,
}: {
  experimentId: string;
}) {
  return (
    <Dialog>
      <DialogContent>
        <Suspense fallback={<ExperimentDetailsDialogSkeleton />}>
          <ExperimentDetailsDialogContent experimentId={experimentId} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

const errorMessageCellCSS = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const detailRowCSS = css`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
  padding: var(--ac-global-dimension-size-50) 0;
`;

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div css={detailRowCSS}>
      <Text weight="heavy" size="S" color="text-700">
        {label}
      </Text>
      <Text size="S">{children}</Text>
    </div>
  );
}

/**
 * Map raw error category to a human-readable level label.
 */
function categoryToLevel(category: string): string {
  switch (category) {
    case "EXPERIMENT":
      return "Experiment";
    case "TASK":
      return "Task";
    case "EVAL":
      return "Eval";
    default:
      return category;
  }
}

type ErrorNode =
  ExperimentDetailsDialog_jobErrors$data["errors"]["edges"][number]["node"];

type ErrorRow = {
  id: string;
  occurredAt: string;
  occurredAtFormatted: string;
  category: string;
  message: string;
  detail: ErrorNode["detail"];
};

function formatWorkItem(detail: ErrorRow["detail"]): string | null {
  if (!detail || detail.__typename === "%other") return null;
  const workItem = detail.workItem;
  if (!workItem || workItem.__typename === "%other") return null;
  if (workItem.__typename === "TaskWorkItemId") {
    return `Example ${workItem.datasetExampleId}, Rep ${workItem.repetitionNumber}`;
  }
  if (workItem.__typename === "EvalWorkItemId") {
    return `Run ${workItem.experimentRunId}, Evaluator ${workItem.datasetEvaluatorId}`;
  }
  return null;
}

function formatDetailMessage(detail: ErrorRow["detail"]): string | null {
  if (!detail || detail.__typename === "%other") return null;
  if (detail.__typename === "RetriesExhaustedDetail") {
    return `${detail.reason} (after ${detail.retryCount} retries)`;
  }
  if (detail.__typename === "FailureDetail") {
    return detail.errorType;
  }
  return null;
}

function ErrorMessageCell({ row }: { row: ErrorRow }) {
  const { viewer } = useViewer();
  const isAdmin = !viewer || viewer.role.name === "ADMIN";
  const detailMsg = formatDetailMessage(row.detail);
  const displayText = detailMsg ?? row.message;
  return (
    <Flex
      direction="row"
      gap="size-50"
      alignItems="center"
      justifyContent="space-between"
      css={css`
        min-width: 0;
      `}
    >
      <span title={row.message} css={errorMessageCellCSS}>
        {displayText}
      </span>
      {isAdmin && (
        <CopyToClipboardButton
          text={row.message}
          size="S"
          tooltipText="Copy full message"
        />
      )}
    </Flex>
  );
}

const ERROR_COL_LEVEL_WIDTH = 150;
const ERROR_COL_TIME_WIDTH = 150;
const ERROR_COL_WORK_ITEM_WIDTH = 250;

function JobErrorsSection({
  jobRef,
}: {
  jobRef: ExperimentDetailsDialog_jobErrors$key;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const [data, refetch] = useRefetchableFragment(
    graphql`
      fragment ExperimentDetailsDialog_jobErrors on ExperimentJob
      @refetchable(queryName: "ExperimentDetailsDialogJobErrorsQuery") {
        errors(first: $errorsFirst, after: $errorsAfter)
          @connection(key: "ExperimentDetailsDialog_errors") {
          edges {
            node {
              id
              occurredAt
              category
              message
              detail {
                __typename
                ... on FailureDetail {
                  errorType
                  workItem {
                    __typename
                    ... on TaskWorkItemId {
                      datasetExampleId
                      repetitionNumber
                    }
                    ... on EvalWorkItemId {
                      experimentRunId
                      datasetEvaluatorId
                    }
                  }
                }
                ... on RetriesExhaustedDetail {
                  retryCount
                  reason
                  workItem {
                    __typename
                    ... on TaskWorkItemId {
                      datasetExampleId
                      repetitionNumber
                    }
                    ... on EvalWorkItemId {
                      experimentRunId
                      datasetEvaluatorId
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
    jobRef
  );

  const errors = useMemo(() => {
    const nodes = data.errors?.edges?.map((e) => e.node) ?? [];
    // Sort EXPERIMENT-level errors to the top (they're the summary/circuit-breaker),
    // then preserve the backend's most-recent-first ordering within each group
    return [...nodes].sort((a, b) => {
      if (a.category === "EXPERIMENT" && b.category !== "EXPERIMENT") return -1;
      if (a.category !== "EXPERIMENT" && b.category === "EXPERIMENT") return 1;
      return 0;
    });
  }, [data.errors]);
  const hasNextPage = data.errors?.pageInfo?.hasNextPage ?? false;

  const tableData: ErrorRow[] = useMemo(
    () =>
      errors.map((e) => ({
        id: e.id,
        occurredAt: e.occurredAt,
        occurredAtFormatted: fullTimeFormatter(new Date(e.occurredAt)),
        category: e.category,
        message: e.message,
        detail: e.detail,
      })),
    [errors, fullTimeFormatter]
  );

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadMore = useCallback(() => {
    setIsLoadingMore(true);
    startTransition(() => {
      refetch(
        { errorsAfter: data.errors?.pageInfo?.endCursor },
        { onComplete: () => setIsLoadingMore(false) }
      );
    });
  }, [refetch, data.errors?.pageInfo?.endCursor]);

  if (errors.length === 0) {
    return null;
  }

  return (
    <Disclosure id="errors">
      <DisclosureTrigger arrowPosition="start">
        <Heading level={3} weight="heavy">
          {`Errors (${errors.length})`}
        </Heading>
      </DisclosureTrigger>
      <DisclosurePanel>
        <div
          css={css`
            overflow-x: auto;
          `}
        >
          <table
            css={[
              tableCSS,
              css`
                table-layout: fixed;
                width: 100%;
              `,
            ]}
          >
            <colgroup>
              <col style={{ width: ERROR_COL_LEVEL_WIDTH }} />
              <col style={{ width: ERROR_COL_TIME_WIDTH }} />
              <col style={{ width: ERROR_COL_WORK_ITEM_WIDTH }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>level</th>
                <th>time</th>
                <th>work item</th>
                <th>error</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Text size="S" color="text-700">
                      {categoryToLevel(row.category)}
                    </Text>
                  </td>
                  <td>
                    <Text size="S" title={row.occurredAtFormatted}>
                      {formatDistance(new Date(row.occurredAt), new Date(), {
                        addSuffix: true,
                      })}
                    </Text>
                  </td>
                  <td>
                    <Text size="S" color="text-700">
                      {formatWorkItem(row.detail) ?? "—"}
                    </Text>
                  </td>
                  <td>
                    <ErrorMessageCell row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasNextPage && (
            <View padding="size-100">
              <Flex justifyContent="center">
                <LoadMoreButton
                  onLoadMore={loadMore}
                  isLoadingNext={isLoadingMore}
                />
              </Flex>
            </View>
          )}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}

function ExperimentDetailsDialogContent({
  experimentId,
}: {
  experimentId: string;
}) {
  const { datasetId } = useParams();
  const { fullTimeFormatter } = useTimeFormatters();
  const data = useLazyLoadQuery<ExperimentDetailsDialogQuery>(
    graphql`
      query ExperimentDetailsDialogQuery(
        $experimentId: ID!
        $errorsFirst: Int = 20
        $errorsAfter: String = null
      ) {
        experiment: node(id: $experimentId) {
          ... on Experiment {
            id
            name
            description
            sequenceNumber
            createdAt
            updatedAt
            metadata
            repetitions
            errorRate
            runCount
            expectedRunCount
            averageRunLatencyMs
            project {
              id
            }
            user {
              username
              profilePictureUrl
            }
            costSummary {
              total {
                tokens
                cost
              }
              prompt {
                tokens
                cost
              }
              completion {
                tokens
                cost
              }
            }
            job {
              status
              createdAt
              maxConcurrency
              ...ExperimentDetailsDialog_jobErrors
              taskConfig {
                id
                streamModelOutput
                prompt {
                  modelProvider
                  modelName
                  templateType
                  templateFormat
                  invocationParameters
                }
                connection {
                  ... on OpenAIConnectionConfig {
                    __typename
                    baseUrl
                    openaiApiType
                  }
                  ... on AzureOpenAIConnectionConfig {
                    __typename
                    azureEndpoint
                    openaiApiType
                  }
                  ... on AnthropicConnectionConfig {
                    __typename
                    baseUrl
                  }
                  ... on AWSBedrockConnectionConfig {
                    __typename
                    regionName
                    endpointUrl
                  }
                  ... on GoogleGenAIConnectionConfig {
                    __typename
                    baseUrl
                  }
                }
              }
            }
          }
        }
      }
    `,
    { experimentId }
  );

  const experiment = data.experiment;
  if (!experiment) {
    return (
      <>
        <DialogHeader>
          <Heading level={2}>Experiment Not Found</Heading>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Text>The experiment could not be found.</Text>
        </View>
      </>
    );
  }

  const job = experiment.job;
  const taskConfig = job?.taskConfig;

  return (
    <>
      <DialogHeader>
        <Flex direction="row" gap="size-100" alignItems="center">
          {experiment.sequenceNumber != null && (
            <SequenceNumberToken sequenceNumber={experiment.sequenceNumber} />
          )}
          <TitleWithID title={experiment.name} id={experimentId} />
          <ExperimentStatus status={job?.status ?? null} />
        </Flex>
        <DialogTitleExtra>
          <LinkButton
            size="S"
            to={`/datasets/${datasetId}/compare?experimentId=${encodeURIComponent(experimentId)}`}
          >
            Experiment Results
          </LinkButton>
          <DialogCloseButton slot="close" />
        </DialogTitleExtra>
      </DialogHeader>
      <div
        css={css`
          flex: 1 1 auto;
          overflow-y: auto;
        `}
      >
        <DisclosureGroup
          defaultExpandedKeys={[
            "overview",
            ...(taskConfig ? ["task-config"] : []),
            "errors",
          ]}
        >
          {/* Overview */}
          <Disclosure id="overview">
            <DisclosureTrigger arrowPosition="start">
              <Heading level={3} weight="heavy">
                Overview
              </Heading>
            </DisclosureTrigger>
            <DisclosurePanel>
              <View padding="size-200">
                {experiment.description && (
                  <View paddingBottom="size-100">
                    <Text size="S" color="text-700">
                      {experiment.description}
                    </Text>
                  </View>
                )}
                {experiment.createdAt && (
                  <DetailRow label="Created">
                    {fullTimeFormatter(new Date(experiment.createdAt))}
                  </DetailRow>
                )}
                {experiment.updatedAt && (
                  <DetailRow label="Updated">
                    {fullTimeFormatter(new Date(experiment.updatedAt))}
                  </DetailRow>
                )}
                <DetailRow label="User">
                  <Flex direction="row" gap="size-50" alignItems="center">
                    <UserPicture
                      name={experiment.user?.username}
                      profilePictureUrl={experiment.user?.profilePictureUrl}
                      size={16}
                    />
                    {experiment.user?.username ?? "system"}
                  </Flex>
                </DetailRow>
                <DetailRow label="Runs">
                  {intFormatter(experiment.runCount)} /{" "}
                  {intFormatter(experiment.expectedRunCount)}
                </DetailRow>
                <DetailRow label="Repetitions">
                  {intFormatter(experiment.repetitions)}
                </DetailRow>
                {experiment.errorRate != null && (
                  <DetailRow label="Error Rate">
                    {formatPercent(experiment.errorRate * 100)}
                  </DetailRow>
                )}
                {experiment.averageRunLatencyMs != null && (
                  <DetailRow label="Avg Latency">
                    <LatencyText latencyMs={experiment.averageRunLatencyMs} />
                  </DetailRow>
                )}
                {experiment.costSummary?.total?.cost != null && (
                  <DetailRow label="Total Cost">
                    {formatCost(experiment.costSummary.total.cost)}
                  </DetailRow>
                )}
                {experiment.costSummary?.total?.tokens != null && (
                  <DetailRow label="Total Tokens">
                    {intFormatter(experiment.costSummary.total.tokens)}
                  </DetailRow>
                )}
                {experiment.metadata != null && (
                  <View paddingTop="size-100">
                    <Text weight="heavy" size="S" color="text-700">
                      Metadata
                    </Text>
                    <JSONBlock
                      value={JSON.stringify(experiment.metadata, null, 2)}
                    />
                  </View>
                )}
              </View>
            </DisclosurePanel>
          </Disclosure>

          {/* Task Config */}
          {taskConfig && (
            <Disclosure id="task-config">
              <DisclosureTrigger arrowPosition="start">
                <Heading level={3} weight="heavy">
                  Task Configuration
                </Heading>
              </DisclosureTrigger>
              <DisclosurePanel>
                <View padding="size-200">
                  <DetailRow label="Model Provider">
                    {taskConfig.prompt.modelProvider}
                  </DetailRow>
                  <DetailRow label="Model Name">
                    {taskConfig.prompt.modelName}
                  </DetailRow>
                  <DetailRow label="Template Type">
                    {taskConfig.prompt.templateType}
                  </DetailRow>
                  <DetailRow label="Template Format">
                    {taskConfig.prompt.templateFormat}
                  </DetailRow>
                  <DetailRow label="Stream Output">
                    {taskConfig.streamModelOutput ? "Yes" : "No"}
                  </DetailRow>
                  {job?.maxConcurrency != null && (
                    <DetailRow label="Max Concurrency">
                      {intFormatter(job.maxConcurrency)}
                    </DetailRow>
                  )}
                  {taskConfig.connection?.__typename && (
                    <DetailRow label="Connection">
                      {taskConfig.connection.__typename.replace(
                        "ConnectionConfig",
                        ""
                      )}
                    </DetailRow>
                  )}
                  {taskConfig.prompt.invocationParameters != null && (
                    <View paddingTop="size-100">
                      <Text weight="heavy" size="S" color="text-700">
                        Invocation Parameters
                      </Text>
                      <JSONBlock
                        value={JSON.stringify(
                          taskConfig.prompt.invocationParameters,
                          null,
                          2
                        )}
                      />
                    </View>
                  )}
                </View>
              </DisclosurePanel>
            </Disclosure>
          )}

          {/* Errors */}
          {job && <JobErrorsSection jobRef={job} />}
        </DisclosureGroup>
      </div>
    </>
  );
}
