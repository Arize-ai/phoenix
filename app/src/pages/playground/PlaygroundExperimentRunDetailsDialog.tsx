import { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

import { Card, CardProps } from "@arizeai/components";

import {
  Button,
  CopyToClipboardButton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Heading,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { JSONBlock } from "@phoenix/components/code";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { LatencyText } from "@phoenix/components/trace/LatencyText";

import type { PlaygroundExperimentRunDetailsDialogQuery } from "./__generated__/PlaygroundExperimentRunDetailsDialogQuery.graphql";

/**
 * A slide-over that shows the details of a playground experiment run.
 */
export function PlaygroundExperimentRunDetailsDialog({
  runId,
  onDismiss,
}: {
  runId: string;
  onDismiss?: () => void;
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
    <Dialog
      css={css`
        width: 85vw;
        max-width: 1400px;
        margin: 0 auto;
      `}
    >
      {(_) => (
        <DialogContent
          css={css`
            overflow: hidden;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
          `}
        >
          <DialogHeader>
            <DialogTitle>Experiment Run for Example: {exampleId}</DialogTitle>
            <DialogTitleExtra>
              <Button
                size="S"
                data-testid="dialog-close-button"
                leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
                onPress={() => {
                  onDismiss?.();
                }}
                type="button"
                variant="default"
                slot="close"
                css={css`
                  cursor: pointer;
                  z-index: 1000;
                `}
              />
            </DialogTitleExtra>
          </DialogHeader>
          <View
            css={css`
              height: calc(100vh - 60px);
              overflow: auto;
              padding: 0 16px 16px 16px;
              width: 100%;
              box-sizing: border-box;
            `}
          >
            <PanelGroup
              direction="vertical"
              autoSaveId="example-compare-panel-group"
              style={{ height: "calc(100vh - 120px)", width: "100%" }}
            >
              <Panel defaultSize={25} style={{ minHeight: 150, width: "100%" }}>
                <View
                  overflow="auto"
                  height="100%"
                  padding="size-200"
                  width="100%"
                >
                  <Flex
                    direction="row"
                    gap="size-200"
                    flex="1 1 auto"
                    width="100%"
                  >
                    <View width="50%">
                      <Card
                        title="Input"
                        {...defaultCardProps}
                        bodyStyle={{
                          padding: 0,
                          maxHeight: "200px",
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
                          maxHeight: "200px",
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
              </Panel>
              <PanelResizeHandle css={resizeHandleCSS} />
              <Panel defaultSize={75} style={{ minHeight: 150, width: "100%" }}>
                <Flex direction="column" height="100%" width="100%">
                  <View
                    paddingStart="size-200"
                    paddingEnd="size-200"
                    paddingTop="size-100"
                    paddingBottom="size-100"
                    borderBottomColor="dark"
                    borderBottomWidth="thin"
                    flex="none"
                    marginTop="size-100"
                  >
                    <Heading level={2}>Experiment Run Output</Heading>
                  </View>
                  <View
                    css={css`
                      overflow-y: auto;
                      height: 100%;
                      padding: var(--ac-global-dimension-static-size-200);
                      width: 100%;
                      box-sizing: border-box;
                      display: flex;
                      flex-direction: row;
                      max-width: 100%;
                    `}
                  >
                    <div
                      css={css`
                        flex: 1;
                        min-width: 0;
                        overflow: hidden;
                        margin-right: 16px;
                        position: relative;
                      `}
                    >
                      {run.error ? (
                        <View padding="size-200">
                          <RunError error={run.error} />
                        </View>
                      ) : (
                        <div
                          css={css`
                            width: 100%;
                            max-width: 100%;
                            overflow: hidden;
                            .cm-editor {
                              max-width: 100% !important;
                            }
                            .cm-scroller {
                              overflow-x: auto !important;
                            }
                          `}
                        >
                          <JSONBlock
                            value={JSON.stringify(run.output, null, 2)}
                          />
                        </div>
                      )}
                      <div
                        css={css`
                          position: absolute;
                          top: 8px;
                          right: 8px;
                          display: flex;
                          flex-direction: column;
                          align-items: flex-end;
                          gap: 8px;
                          pointer-events: none;
                        `}
                      >
                        {run.startTime && run.endTime && (
                          <RunLatency
                            startTime={run.startTime}
                            endTime={run.endTime}
                          />
                        )}
                        <ul
                          css={css`
                            margin: 0;
                            padding: 0;
                            list-style: none;
                            display: flex;
                            flex-direction: column;
                            justify-content: flex-start;
                            align-items: flex-end;
                            gap: var(--ac-global-dimension-static-size-100);
                          `}
                        >
                          {run.annotations?.edges.map((edge) => (
                            <li key={edge.annotation.id}>
                              <AnnotationLabel annotation={edge.annotation} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </View>
                </Flex>
              </Panel>
            </PanelGroup>
          </View>
        </DialogContent>
      )}
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
