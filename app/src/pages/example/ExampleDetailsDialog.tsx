import { Suspense, useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

import {
  Button,
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
  ListBox,
  Popover,
  Select,
  SelectItem,
  SelectValue,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { DatasetSplits } from "@phoenix/components/datasetSplit/DatasetSplits";
import { DynamicContent } from "@phoenix/components/DynamicContent";
import { SelectChevronUpDownIcon } from "@phoenix/components/icon";
import { Skeleton } from "@phoenix/components/loading";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useNotifySuccess } from "@phoenix/contexts";
import { AssignExamplesToSplitMenu } from "@phoenix/pages/examples/AssignExamplesToSplitMenu";
import { Mutable } from "@phoenix/typeUtils";

import type { ExampleDetailsDialogQuery } from "./__generated__/ExampleDetailsDialogQuery.graphql";
import { EditExampleButton } from "./EditExampleButton";
import { ExampleExperimentRunsTable } from "./ExampleExperimentRunsTable";

type ViewMode = "json" | "pretty";

/**
 * Extracts the display value for "pretty" mode.
 * If the value is an object with a single key and the value is a string,
 * returns just that string for markdown rendering.
 * Otherwise returns the original value.
 */
function extractPrettyValue(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1) {
      const innerValue = (value as Record<string, unknown>)[keys[0]];
      // If the inner value is a string, return it directly for markdown rendering
      if (typeof innerValue === "string") {
        return innerValue;
      }
    }
  }
  return value;
}

/**
 * A select component for switching between JSON and Pretty view modes.
 */
function ViewModeSelect({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <Select
      size="S"
      selectedKey={value}
      onSelectionChange={(key) => onChange(key as ViewMode)}
      aria-label="View mode"
    >
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          <SelectItem id="json" textValue="JSON">
            JSON
          </SelectItem>
          <SelectItem id="pretty" textValue="Pretty">
            Pretty
          </SelectItem>
        </ListBox>
      </Popover>
    </Select>
  );
}

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
  const [inputViewMode, setInputViewMode] = useState<ViewMode>("pretty");
  const [outputViewMode, setOutputViewMode] = useState<ViewMode>("pretty");
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
    const rev = data.example.revision;
    return {
      input: JSON.stringify(rev?.input, null, 2),
      output: JSON.stringify(rev?.output, null, 2),
      metadata: JSON.stringify(rev?.metadata, null, 2),
      // Raw values for DynamicContent
      inputRaw: rev?.input,
      outputRaw: rev?.output,
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
                    extra={
                      <Flex direction="row" gap="size-100" alignItems="center">
                        <ViewModeSelect
                          value={inputViewMode}
                          onChange={setInputViewMode}
                        />
                        <CopyToClipboardButton text={input} />
                      </Flex>
                    }
                  >
                    {inputViewMode === "json" ? (
                      <JSONBlock value={input} />
                    ) : (
                      <View padding="size-200">
                        <DynamicContent
                          value={extractPrettyValue(revision.inputRaw)}
                        />
                      </View>
                    )}
                  </Card>
                  <Card
                    title="Output"
                    {...defaultCardProps}
                    extra={
                      <Flex direction="row" gap="size-100" alignItems="center">
                        <ViewModeSelect
                          value={outputViewMode}
                          onChange={setOutputViewMode}
                        />
                        <CopyToClipboardButton text={output} />
                      </Flex>
                    }
                  >
                    {outputViewMode === "json" ? (
                      <JSONBlock value={output} />
                    ) : (
                      <View padding="size-200">
                        <DynamicContent
                          value={extractPrettyValue(revision.outputRaw)}
                        />
                      </View>
                    )}
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
