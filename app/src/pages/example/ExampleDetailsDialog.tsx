import { Suspense, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

import {
  Card,
  CardProps,
  CopyToClipboardButton,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Heading,
  LinkButton,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { DatasetSplits } from "@phoenix/components/datasetSplit/DatasetSplits";
import { Skeleton } from "@phoenix/components/loading";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useNotifySuccess } from "@phoenix/contexts";
import { AssignExamplesToSplitMenu } from "@phoenix/pages/examples/AssignExamplesToSplitMenu";
import { Mutable } from "@phoenix/typeUtils";

import type { ExampleDetailsDialogQuery } from "./__generated__/ExampleDetailsDialogQuery.graphql";
import { EditExampleButton } from "./EditExampleButton";
import { ExampleExperimentRunsTable } from "./ExampleExperimentRunsTable";

/**
 * Skeleton fallback for the dialog content while data is loading.
 */
function ExampleDetailsDialogSkeleton() {
  return (
    <PanelGroup direction="vertical" autoSaveId="example-panel-group">
      <Panel defaultSize={65}>
        <div
          css={css`
            overflow-y: auto;
            height: 100%;
          `}
        >
          <Flex direction="row" justifyContent="center">
            <View width="900px" padding="size-200">
              <Flex direction="column" gap="size-200">
                <Card title="Input" {...defaultCardProps}>
                  <Skeleton height={100} animation="wave" />
                </Card>
                <Card title="Output" {...defaultCardProps}>
                  <Skeleton height={100} animation="wave" />
                </Card>
                <Card title="Metadata" {...defaultCardProps}>
                  <Skeleton height={60} animation="wave" />
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
          <View padding="size-200" flex="1 1 auto">
            <Flex direction="column" gap="size-100">
              <Skeleton height={40} animation="wave" />
              <Skeleton height={40} animation="wave" />
              <Skeleton height={40} animation="wave" />
            </Flex>
          </View>
        </Flex>
      </Panel>
    </PanelGroup>
  );
}

/**
 * Inner content component that fetches data and renders the example details.
 */
function ExampleDetailsDialogContent({
  exampleId,
  datasetVersionId,
}: {
  exampleId: string;
  datasetVersionId?: string;
}) {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<ExampleDetailsDialogQuery>(
    graphql`
      query ExampleDetailsDialogQuery($exampleId: ID!, $datasetVersionId: ID) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            id
            revision(datasetVersionId: $datasetVersionId) {
              input
              output
              metadata
            }
            datasetSplits {
              id
              name
              color
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
    { exampleId: exampleId as string, datasetVersionId: datasetVersionId },
    { fetchKey, fetchPolicy: "store-and-network" }
  );
  const revision = useMemo(() => {
    const revision = data.example.revision;
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
  const datasetSplits = data.example.datasetSplits ?? [];
  const examplesCache = useMemo(() => {
    const example = data.example;
    if (example && example.id) {
      return {
        [example.id]: {
          id: example.id,
          datasetSplits: (example.datasetSplits ?? []) as Mutable<
            NonNullable<typeof example.datasetSplits>
          >,
        },
      };
    }
    return {};
  }, [data]);
  const notifySuccess = useNotifySuccess();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Example: {exampleId}</DialogTitle>
        <DialogTitleExtra>
          <DatasetSplits labels={datasetSplits} />
          {sourceSpanInfo ? (
            <LinkButton
              size="S"
              to={`/projects/${sourceSpanInfo.projectId}/traces/${sourceSpanInfo.traceId}?${SELECTED_SPAN_NODE_ID_PARAM}=${sourceSpanInfo.id}`}
            >
              View Source Span
            </LinkButton>
          ) : null}
          <AssignExamplesToSplitMenu
            selectedExampleIds={[exampleId]}
            examplesCache={examplesCache}
            size="S"
          />
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
          <DialogCloseButton />
        </DialogTitleExtra>
      </DialogHeader>
      <PanelGroup direction="vertical" autoSaveId="example-panel-group">
        <Panel defaultSize={65}>
          <div
            css={css`
              overflow-y: auto;
              height: 100%;
            `}
          >
            <Flex direction="row" justifyContent="center">
              <View width="900px" padding="size-200">
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
    </>
  );
}

/**
 * Skeleton fallback for the dialog header while data is loading.
 */
function ExampleDetailsHeaderSkeleton({ exampleId }: { exampleId: string }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Example: {exampleId}</DialogTitle>
        <DialogTitleExtra>
          <Skeleton width={60} height={24} animation="wave" />
          <DialogCloseButton />
        </DialogTitleExtra>
      </DialogHeader>
      <ExampleDetailsDialogSkeleton />
    </>
  );
}

/**
 * A Slide-over that shows the details of a dataset example.
 */
export function ExampleDetailsDialog({
  exampleId,
  datasetVersionId,
}: {
  exampleId: string;
  datasetVersionId?: string;
}) {
  return (
    <Dialog>
      <DialogContent>
        <Suspense
          fallback={<ExampleDetailsHeaderSkeleton exampleId={exampleId} />}
        >
          <ExampleDetailsDialogContent
            exampleId={exampleId}
            datasetVersionId={datasetVersionId}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

const defaultCardProps: Partial<CardProps> = {
  backgroundColor: "light",
  borderColor: "light",
  collapsible: true,
};
