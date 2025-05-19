import { useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

import { Card, CardProps, Dialog, DialogContainer } from "@arizeai/components";

import {
  CopyToClipboardButton,
  Flex,
  Heading,
  LinkButton,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useNotifySuccess } from "@phoenix/contexts";

import type { ExampleDetailsDialogQuery } from "./__generated__/ExampleDetailsDialogQuery.graphql";
import { EditExampleButton } from "./EditExampleButton";
import { ExampleExperimentRunsTable } from "./ExampleExperimentRunsTable";

/**
 * A Slide-over that shows the details of a dataset example.
 */
export function ExampleDetailsDialog({
  exampleId,
  onDismiss,
}: {
  exampleId: string;
  onDismiss: () => void;
}) {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<ExampleDetailsDialogQuery>(
    graphql`
      query ExampleDetailsDialogQuery($exampleId: ID!) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            id
            latestRevision: revision {
              input
              output
              metadata
            }
            span {
              id
              trace {
                id
                traceId
                project {
                  id
                }
              }
            }
          }
          ...ExampleExperimentRunsTableFragment
        }
      }
    `,
    { exampleId: exampleId as string },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const revision = useMemo(() => {
    const revision = data.example.latestRevision;
    return {
      input: JSON.stringify(revision?.input, null, 2),
      output: JSON.stringify(revision?.output, null, 2),
      metadata: JSON.stringify(revision?.metadata, null, 2),
    };
  }, [data]);
  const sourceSpanInfo = useMemo(() => {
    const sourceSpan = data.example.span;
    if (!sourceSpan) {
      return null;
    }
    return {
      id: sourceSpan.id,
      traceId: sourceSpan.trace.traceId,
      projectId: sourceSpan.trace.project.id,
    };
  }, [data]);
  const { input, output, metadata } = revision;
  const notifySuccess = useNotifySuccess();
  return (
    <DialogContainer type="slideOver" isDismissable onDismiss={onDismiss}>
      <Dialog
        size="XL"
        title={`Example: ${exampleId}`}
        extra={
          <Flex direction="row" gap="size-100">
            {sourceSpanInfo ? (
              <LinkButton
                size="S"
                to={`/projects/${sourceSpanInfo.projectId}/traces/${sourceSpanInfo.traceId}?${SELECTED_SPAN_NODE_ID_PARAM}=${sourceSpanInfo.id}`}
              >
                View Source Span
              </LinkButton>
            ) : null}
            <EditExampleButton
              exampleId={exampleId as string}
              currentRevision={revision}
              onCompleted={() => {
                notifySuccess({
                  title: "Example updated",
                  message: `Example ${exampleId} has been updated.`,
                });
                setFetchKey((key) => key + 1);
              }}
            />
          </Flex>
        }
      >
        <PanelGroup direction="vertical" autoSaveId="example-panel-group">
          <Panel defaultSize={65}>
            <div
              css={css`
                overflow-y: auto;
                height: 100%;
              `}
            >
              <Flex direction="row" justifyContent="center">
                <View
                  width="900px"
                  paddingStart="auto"
                  paddingEnd="auto"
                  paddingTop="size-200"
                  paddingBottom="size-200"
                >
                  <Flex direction="column" gap="size-200">
                    <Card
                      title="Input"
                      {...defaultCardProps}
                      extra={<CopyToClipboardButton text={input} />}
                    >
                      <JSONBlock value={input} />
                    </Card>
                    <Card
                      title="Output"
                      {...defaultCardProps}
                      extra={<CopyToClipboardButton text={output} />}
                    >
                      <JSONBlock value={output} />
                    </Card>
                    <Card
                      title="Metadata"
                      {...defaultCardProps}
                      extra={<CopyToClipboardButton text={metadata} />}
                    >
                      <JSONBlock value={metadata} />
                    </Card>
                  </Flex>
                </View>
              </Flex>
            </div>
          </Panel>
          <PanelResizeHandle css={resizeHandleCSS} />
          <Panel defaultSize={35}>
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
                <Heading level={3}>Experiment Runs</Heading>
              </View>
              <ExampleExperimentRunsTable example={data.example} />
            </Flex>
          </Panel>
        </PanelGroup>
      </Dialog>
    </DialogContainer>
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
