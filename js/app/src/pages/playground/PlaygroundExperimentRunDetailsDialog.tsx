import { css } from "@emotion/react";
import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import type { CardProps } from "@phoenix/components";
import {
  Alert,
  Card,
  CopyToClipboardButton,
  Dialog,
  Flex,
  IDBadge,
  Text,
  View,
  ViewSummaryAside,
} from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { JSONBlock } from "@phoenix/components/code";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { PrettyText } from "@phoenix/components/utility/PrettyText";

import type { PlaygroundExperimentRunDetailsDialogQuery } from "./__generated__/PlaygroundExperimentRunDetailsDialogQuery.graphql";

/**
 * A slide-over that shows the details of a playground experiment run.
 */
export function PlaygroundExperimentRunDetailsDialog({
  runId,
}: {
  runId: string;
}) {
  const data = useLazyLoadQuery<PlaygroundExperimentRunDetailsDialogQuery>(
    graphql`
      query PlaygroundExperimentRunDetailsDialogQuery($runId: ID!) {
        run: node(id: $runId) {
          ... on ExperimentRun {
            output
            startTime
            endTime
            error
            example {
              id
              revision {
                input
                output
              }
            }
            annotations {
              edges {
                annotation: node {
                  id
                  name
                  label
                  score
                  explanation
                  annotatorKind
                }
              }
            }
          }
        }
      }
    `,
    { runId }
  );
  const run = data.run;
  const exampleId = run.example?.id;
  const revision = run.example?.revision;
  const input = revision?.input;
  const referenceOutput = revision?.output;
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <Flex direction="row" gap="size-100" alignItems="center" minWidth={0}>
            <DialogTitle>Experiment Run</DialogTitle>
            <IDBadge id={exampleId || ""} />
          </Flex>
          <DialogTitleExtra>
            {run.error ? (
              <CopyToClipboardButton
                text={run.error}
                aria-label="Copy original error"
                tooltipText="Copy original error"
              />
            ) : null}
            <DialogCloseButton aria-label="Close experiment run" />
          </DialogTitleExtra>
        </DialogHeader>
        <div
          className="playground-run-details__body"
          role="region"
          aria-label="Experiment run details"
          tabIndex={0}
          css={css`
            flex: 1 1 auto;
            min-height: 0;
            overflow: auto;
          `}
        >
          {run.error ? (
            <div role="alert">
              <Alert variant="danger" banner title="Experiment run failed">
                <PrettyText variant="compact">{run.error}</PrettyText>
              </Alert>
            </div>
          ) : null}
          <View padding="size-200">
            <Flex direction="column" gap="size-200">
              <Flex direction="row" gap="size-200">
                <View width="50%">
                  <Card
                    title="Input"
                    {...defaultCardProps}
                    extra={
                      <CopyToClipboardButton
                        text={JSON.stringify(input)}
                        aria-label="Copy input"
                      />
                    }
                  >
                    <JSONBlock value={JSON.stringify(input, null, 2)} />
                  </Card>
                </View>
                <View width="50%">
                  <Card
                    title="Reference Output"
                    {...defaultCardProps}
                    extra={
                      <CopyToClipboardButton
                        text={JSON.stringify(referenceOutput)}
                        aria-label="Copy reference output"
                      />
                    }
                  >
                    <JSONBlock
                      value={JSON.stringify(referenceOutput, null, 2)}
                    />
                  </Card>
                </View>
              </Flex>
              <Card
                title="Experiment Run Output"
                {...defaultCardProps}
                extra={
                  run.error ? null : (
                    <CopyToClipboardButton
                      text={JSON.stringify(run.output, null, 2)}
                      aria-label="Copy output"
                    />
                  )
                }
              >
                <Flex direction="row">
                  <View flex="1 1 auto" minWidth={0}>
                    {run.error ? (
                      <View padding="size-200">
                        <Text color="text-700">No output available</Text>
                      </View>
                    ) : (
                      <JSONBlock value={JSON.stringify(run.output, null, 2)} />
                    )}
                  </View>
                  <ViewSummaryAside width="size-3000">
                    {run.startTime && run.endTime && (
                      <RunLatency
                        startTime={run.startTime}
                        endTime={run.endTime}
                      />
                    )}
                    <ul
                      css={css`
                        margin-top: var(--global-dimension-size-100);
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        align-items: flex-end;
                        gap: var(--global-dimension-size-100);
                      `}
                    >
                      {run.annotations?.edges.map((edge) => (
                        <li key={edge.annotation.id}>
                          <AnnotationLabel annotation={edge.annotation} />
                        </li>
                      ))}
                    </ul>
                  </ViewSummaryAside>
                </Flex>
              </Card>
            </Flex>
          </View>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RunLatency({
  startTime,
  endTime,
}: {
  startTime: string;
  endTime: string;
}) {
  const latencyMs = useMemo(() => {
    let latencyMs: number | null = null;
    if (startTime && endTime) {
      latencyMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    }
    return latencyMs;
  }, [startTime, endTime]);
  if (latencyMs === null) {
    return null;
  }
  return <LatencyText latencyMs={latencyMs} />;
}

const defaultCardProps: Partial<CardProps> = {
  collapsible: true,
};
