import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

import {
  Card,
  CardProps,
  Dialog,
  Flex,
  Heading,
  Icon,
  Icons,
  Text,
  View,
} from "@arizeai/components";

import { CopyToClipboardButton, ViewSummaryAside } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { LatencyText } from "@phoenix/components/trace/LatencyText";

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
      query PlaygroundExperimentRunDetailsDialogQuery($runId: GlobalID!) {
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
    <Dialog
      title={`Experiment Run for Example: ${exampleId}`}
      size="fullscreen"
    >
      <PanelGroup direction="vertical" autoSaveId="example-compare-panel-group">
        <Panel defaultSize={100}>
          <div
            css={css`
              overflow-y: auto;
              height: 100%;
            `}
          >
            <View overflow="hidden" padding="size-200">
              <Flex direction="row" gap="size-200" flex="1 1 auto">
                <View width="50%">
                  <Card
                    title="Input"
                    {...defaultCardProps}
                    bodyStyle={{
                      padding: 0,
                      maxHeight: "300px",
                      overflowY: "auto",
                    }}
                    extra={
                      <CopyToClipboardButton text={JSON.stringify(input)} />
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
                      />
                    }
                    bodyStyle={{
                      padding: 0,
                      maxHeight: "300px",
                      overflowY: "auto",
                    }}
                  >
                    <JSONBlock
                      value={JSON.stringify(referenceOutput, null, 2)}
                    />
                  </Card>
                </View>
              </Flex>
            </View>
          </div>
        </Panel>
        <PanelResizeHandle css={resizeHandleCSS} />
        <Panel defaultSize={100}>
          <Flex direction="column" height="100%">
            <View
              paddingStart="size-200"
              paddingEnd="size-200"
              paddingTop="size-100"
              paddingBottom="size-100"
              borderBottomColor="dark"
              borderBottomWidth="thin"
              flex="none"
            >
              <Heading level={2}>Experiment Run Output</Heading>
            </View>
            <div
              css={css`
                overflow-y: auto;
                height: 100%;
                padding: var(--ac-global-dimension-static-size-200);
              `}
            >
              <Flex direction="row">
                <View flex>
                  {run.error ? (
                    <View padding="size-200">
                      <RunError error={run.error} />
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
                </ViewSummaryAside>
              </Flex>
            </div>
          </Flex>
        </Panel>
      </PanelGroup>
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

function RunError({ error }: { error: string }) {
  return (
    <Flex direction="row" gap="size-50" alignItems="center">
      <Icon svg={<Icons.AlertCircleOutline />} color="danger" />
      <Text color="danger">{error}</Text>
    </Flex>
  );
}

const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  variant: "compact",
  collapsible: true,
  bodyStyle: {
    padding: 0,
  },
};
