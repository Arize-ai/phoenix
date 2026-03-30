import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";

import {
  Badge,
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
import { Skeleton } from "@phoenix/components/core/loading";
import {
  ExperimentStatus,
  SequenceNumberToken,
} from "@phoenix/components/experiment";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { useTimeFormatters } from "@phoenix/hooks";
import {
  formatCost,
  formatPercent,
  intFormatter,
} from "@phoenix/utils/numberFormatUtils";

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

const stackTraceCSS = css`
  padding: var(--ac-global-dimension-size-100);
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  background: var(--ac-global-color-grey-100);
  border-radius: var(--ac-global-rounding-small);
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

function ExperimentDetailsDialogContent({
  experimentId,
}: {
  experimentId: string;
}) {
  const { datasetId } = useParams();
  const { fullTimeFormatter } = useTimeFormatters();
  const data = useLazyLoadQuery<ExperimentDetailsDialogQuery>(
    graphql`
      query ExperimentDetailsDialogQuery($experimentId: ID!) {
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
              lastError {
                id
                occurredAt
                category
                message
                detail {
                  ... on FailureDetail {
                    errorType
                    stackTrace
                  }
                  ... on RetriesExhaustedDetail {
                    retryCount
                    reason
                    stackTrace
                  }
                }
              }
              errors(first: 20) {
                edges {
                  node {
                    id
                    occurredAt
                    category
                    message
                    detail {
                      ... on FailureDetail {
                        errorType
                        stackTrace
                      }
                      ... on RetriesExhaustedDetail {
                        retryCount
                        reason
                        stackTrace
                      }
                    }
                  }
                }
              }
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
  const lastError = job?.lastError;
  const errors = job?.errors?.edges ?? [];

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
            ...(lastError ? ["last-error"] : []),
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

          {/* Last Error */}
          {lastError && (
            <Disclosure id="last-error">
              <DisclosureTrigger arrowPosition="start">
                <Heading level={3} weight="heavy">
                  Last Error
                </Heading>
              </DisclosureTrigger>
              <DisclosurePanel>
                <View padding="size-200">
                  <Flex direction="column" gap="size-100">
                    <Flex direction="row" gap="size-100" alignItems="center">
                      <Badge size="S">{lastError.category}</Badge>
                      <Text size="XS" color="text-700">
                        {fullTimeFormatter(new Date(lastError.occurredAt))}
                      </Text>
                    </Flex>
                    <Text size="S">{lastError.message}</Text>
                    {lastError.detail?.stackTrace && (
                      <pre css={stackTraceCSS}>
                        {lastError.detail.stackTrace}
                      </pre>
                    )}
                  </Flex>
                </View>
              </DisclosurePanel>
            </Disclosure>
          )}

          {/* All Errors */}
          {errors.length > 0 && (
            <Disclosure id="all-errors" defaultExpanded={!lastError}>
              <DisclosureTrigger arrowPosition="start">
                <Heading level={3} weight="heavy">
                  {`Errors (${errors.length})`}
                </Heading>
              </DisclosureTrigger>
              <DisclosurePanel>
                <View padding="size-200">
                  <Flex direction="column" gap="size-150">
                    {errors.map(({ node: error }) => (
                      <div
                        key={error.id}
                        css={css`
                          border-bottom: 1px solid var(--ac-global-color-grey-300);
                          padding-bottom: var(--ac-global-dimension-size-100);
                          &:last-child {
                            border-bottom: none;
                          }
                        `}
                      >
                        <Flex direction="column" gap="size-50">
                          <Flex
                            direction="row"
                            gap="size-100"
                            alignItems="center"
                          >
                            <Badge size="S">{error.category}</Badge>
                            <Text size="XS" color="text-700">
                              {fullTimeFormatter(new Date(error.occurredAt))}
                            </Text>
                          </Flex>
                          <Text size="S">{error.message}</Text>
                          {error.detail?.stackTrace && (
                            <pre css={stackTraceCSS}>
                              {error.detail.stackTrace}
                            </pre>
                          )}
                        </Flex>
                      </div>
                    ))}
                  </Flex>
                </View>
              </DisclosurePanel>
            </Disclosure>
          )}
        </DisclosureGroup>
      </div>
    </>
  );
}
