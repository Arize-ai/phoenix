import React, {
  ReactNode,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Disposable,
  graphql,
  useLazyLoadQuery,
  usePaginationFragment,
  useRelayEnvironment,
} from "react-relay";
import {
  CellContext,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import { GraphQLSubscriptionConfig, requestSubscription } from "relay-runtime";
import { css } from "@emotion/react";

import {
  Button,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@arizeai/components";

import { Loading } from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { JSONText } from "@phoenix/components/code/JSONText";
import { CellWithControlsWrap } from "@phoenix/components/table";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { EditSpanAnnotationsDialog } from "@phoenix/components/trace/EditSpanAnnotationsDialog";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { useNotifyError } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundInstance } from "@phoenix/store";
import { assertUnreachable } from "@phoenix/typeUtils";

import type { PlaygroundDatasetExamplesTableFragment$key } from "./__generated__/PlaygroundDatasetExamplesTableFragment.graphql";
import { PlaygroundDatasetExamplesTableQuery } from "./__generated__/PlaygroundDatasetExamplesTableQuery.graphql";
import { PlaygroundDatasetExamplesTableRefetchQuery } from "./__generated__/PlaygroundDatasetExamplesTableRefetchQuery.graphql";
import PlaygroundDatasetExamplesTableSubscription, {
  PlaygroundDatasetExamplesTableSubscription as PlaygroundDatasetExamplesTableSubscriptionType,
  PlaygroundDatasetExamplesTableSubscription$data,
} from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import { PlaygroundRunTraceDetailsDialog } from "./PlaygroundRunTraceDialog";
import {
  PartialOutputToolCall,
  PlaygroundToolCall,
} from "./PlaygroundToolCall";
import { getChatCompletionOverDatasetInput } from "./playgroundUtils";

const PAGE_SIZE = 100;

type InstanceId = number;
type ExampleId = string;
type Span = NonNullable<
  Extract<
    PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
    { __typename: "ChatCompletionSubscriptionResult" }
  >["span"]
>;

type ExampleRunData =
  | {
      content?: string;
      toolCalls?: Record<string, PartialOutputToolCall | undefined>;
      span?: Span | null;
    }
  | undefined;

type InstanceToExampleResponsesMap = Record<
  InstanceId,
  Record<ExampleId, ExampleRunData> | undefined
>;

const getInitialExampleResponsesMap = (instances: PlaygroundInstance[]) => {
  return instances.reduce((acc, instance) => {
    return {
      ...acc,
      [instance.id]: {},
    };
  }, {});
};

function LargeTextWrap({ children }: { children: ReactNode }) {
  return (
    <div
      css={css`
        max-height: 300px;
        overflow-y: auto;
      `}
    >
      {children}
    </div>
  );
}

function JSONCell<TData extends object, TValue>({
  getValue,
  collapseSingleKey,
}: CellContext<TData, TValue> & { collapseSingleKey?: boolean }) {
  const value = getValue();
  return (
    <LargeTextWrap>
      <JSONText json={value} space={2} collapseSingleKey={collapseSingleKey} />
    </LargeTextWrap>
  );
}

function SpanMetadata({ span }: { span: Span }) {
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <TokenCount
        tokenCountTotal={span.tokenCountTotal || 0}
        tokenCountPrompt={span.tokenCountPrompt || 0}
        tokenCountCompletion={span.tokenCountCompletion || 0}
      />
      <LatencyText latencyMs={span.latencyMs || 0} />
    </Flex>
  );
}

// un-memoized normal table body component - see memoized version below
function TableBody<T>({ table }: { table: Table<T> }) {
  return (
    <tbody>
      {table.getRowModel().rows.map((row) => (
        <tr key={row.id}>
          {row.getVisibleCells().map((cell) => {
            return (
              <td
                key={cell.id}
                style={{
                  width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}
// special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = React.memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody;

export function PlaygroundDatasetExamplesTable({
  datasetId,
}: {
  datasetId: string;
}) {
  const environment = useRelayEnvironment();
  const instances = usePlaygroundContext((state) => state.instances);
  const setExperimentId = usePlaygroundContext(
    (state) => state.setExperimentId
  );
  const [dialog, setDialog] = useState<ReactNode>(null);

  const hasSomeRunIds = instances.some(
    (instance) => instance.activeRunId !== null
  );

  const credentials = useCredentialsContext((state) => state);
  const markPlaygroundInstanceComplete = usePlaygroundContext(
    (state) => state.markPlaygroundInstanceComplete
  );
  const playgroundStore = usePlaygroundStore();

  const [exampleResponsesMap, setExampleResponsesMap] =
    useState<InstanceToExampleResponsesMap>(
      getInitialExampleResponsesMap(instances)
    );
  const notifyError = useNotifyError();

  const onNext = useCallback(
    (instanceId: number) =>
      (response?: PlaygroundDatasetExamplesTableSubscription$data | null) => {
        if (response == null) {
          return;
        }
        const chatCompletion = response.chatCompletionOverDataset;
        switch (chatCompletion.__typename) {
          case "ChatCompletionSubscriptionError":
            markPlaygroundInstanceComplete(instanceId);
            notifyError({
              title: "Chat completion failed",
              message: chatCompletion.message,
              expireMs: 10000,
            });
            return;
          case "ChatCompletionSubscriptionExperiment":
            setExperimentId(chatCompletion.experiment.id);
            break;
          case "ChatCompletionSubscriptionResult": {
            const { span, datasetExampleId } = chatCompletion;
            if (datasetExampleId != null) {
              setExampleResponsesMap((exampleResponsesMap) => {
                const existingInstanceResponses =
                  exampleResponsesMap[instanceId];
                const existingExampleResponse =
                  existingInstanceResponses?.[datasetExampleId] ?? {};
                const newInstanceExampleResponseMap = {
                  ...existingInstanceResponses,
                  [datasetExampleId]: {
                    ...existingExampleResponse,
                    span: span,
                  },
                };
                return {
                  ...exampleResponsesMap,
                  [instanceId]: newInstanceExampleResponseMap,
                };
              });
            }
            return;
          }
          case "TextChunk": {
            const { content, datasetExampleId } = chatCompletion;
            if (datasetExampleId == null) {
              return;
            }
            setExampleResponsesMap((exampleResponsesMap) => {
              const existingInstanceResponses = exampleResponsesMap[instanceId];
              const existingExampleResponse =
                existingInstanceResponses?.[datasetExampleId] ?? {};
              const newInstanceExampleResponseMap = {
                ...existingInstanceResponses,
                [datasetExampleId]: {
                  ...existingExampleResponse,
                  content: (existingExampleResponse?.content ?? "") + content,
                },
              };
              return {
                ...exampleResponsesMap,
                [instanceId]: newInstanceExampleResponseMap,
              };
            });
            return;
          }
          case "ToolCallChunk": {
            const {
              datasetExampleId,
              function: toolFunction,
              id,
            } = chatCompletion;
            if (datasetExampleId == null) {
              return null;
            }
            setExampleResponsesMap((exampleResponsesMap) => {
              const existingInstanceResponses = exampleResponsesMap[instanceId];
              const existingExampleResponse =
                existingInstanceResponses?.[datasetExampleId] ?? {};
              const existingToolCalls = existingExampleResponse.toolCalls ?? {};
              const existingToolCall = existingToolCalls[id];
              const updatedToolCall: PartialOutputToolCall = {
                ...existingToolCall,
                id,
                function: {
                  name: existingToolCall?.function?.name ?? toolFunction.name,
                  arguments:
                    existingToolCall?.function.arguments != null
                      ? existingToolCall.function.arguments +
                        toolFunction.arguments
                      : toolFunction.arguments,
                },
              };
              const newInstanceExampleResponseMap = {
                ...existingInstanceResponses,
                [datasetExampleId]: {
                  ...existingExampleResponse,
                  toolCalls: {
                    ...existingToolCalls,
                    [id]: updatedToolCall,
                  },
                },
              };
              return {
                ...exampleResponsesMap,
                [instanceId]: newInstanceExampleResponseMap,
              };
            });
            return;
          }
          // This should never happen
          // As relay puts it in generated files "This will never be '%other', but we need some value in case none of the concrete values match."
          case "%other":
            return;
          default:
            return assertUnreachable(chatCompletion);
        }
      },
    [markPlaygroundInstanceComplete, notifyError, setExperimentId]
  );

  useEffect(() => {
    if (!hasSomeRunIds) {
      return;
    }
    const { instances, streaming } = playgroundStore.getState();
    if (streaming) {
      const subscriptions: Disposable[] = [];
      setExampleResponsesMap(getInitialExampleResponsesMap(instances));
      for (const instance of instances) {
        const { activeRunId } = instance;
        if (activeRunId === null) {
          continue;
        }
        const variables = {
          input: getChatCompletionOverDatasetInput({
            credentials,
            instanceId: instance.id,
            playgroundStore,
            datasetId,
          }),
        };
        const config: GraphQLSubscriptionConfig<PlaygroundDatasetExamplesTableSubscriptionType> =
          {
            subscription: PlaygroundDatasetExamplesTableSubscription,
            variables,
            onNext: onNext(instance.id),
            onCompleted: () => {
              markPlaygroundInstanceComplete(instance.id);
            },
            onError: (error) => {
              notifyError({
                title: "Chat completion failed",
                message: error.message,
                expireMs: 10000,
              });
              markPlaygroundInstanceComplete(instance.id);
            },
          };
        const subscription = requestSubscription(environment, config);
        subscriptions.push(subscription);
      }
      return () => {
        for (const subscription of subscriptions) {
          subscription.dispose();
        }
      };
    }
  }, [
    credentials,
    datasetId,
    environment,
    hasSomeRunIds,
    markPlaygroundInstanceComplete,
    notifyError,
    onNext,
    playgroundStore,
  ]);

  const { dataset } = useLazyLoadQuery<PlaygroundDatasetExamplesTableQuery>(
    graphql`
      query PlaygroundDatasetExamplesTableQuery($datasetId: GlobalID!) {
        dataset: node(id: $datasetId) {
          ...PlaygroundDatasetExamplesTableFragment
        }
      }
    `,
    { datasetId }
  );

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    PlaygroundDatasetExamplesTableRefetchQuery,
    PlaygroundDatasetExamplesTableFragment$key
  >(
    graphql`
      fragment PlaygroundDatasetExamplesTableFragment on Dataset
      @refetchable(queryName: "PlaygroundDatasetExamplesTableRefetchQuery")
      @argumentDefinitions(
        datasetVersionId: { type: "GlobalID" }
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 100 }
      ) {
        examples(
          datasetVersionId: $datasetVersionId
          first: $first
          after: $after
        ) @connection(key: "PlaygroundDatasetExamplesTable_examples") {
          edges {
            example: node {
              id
              revision {
                input
                output
              }
            }
          }
        }
      }
    `,
    dataset
  );

  // Refetch the data when the dataset version changes
  const tableData = useMemo(
    () =>
      data.examples.edges.map((edge) => {
        const example = edge.example;
        const revision = example.revision;
        return {
          id: example.id,
          input: revision.input,
          output: revision.output,
        };
      }),
    [data]
  );
  type TableRow = (typeof tableData)[number];

  const playgroundInstanceOutputColumns = useMemo((): ColumnDef<TableRow>[] => {
    return instances.map((instance, index) => ({
      id: instance.id.toString(),
      header: () => (
        <Flex direction="row" gap="size-100" alignItems="center">
          <AlphabeticIndexIcon index={index} />
          <span>Output</span>
        </Flex>
      ),

      cell: ({ row }) => {
        const maybeData = exampleResponsesMap[instance.id]?.[row.original.id];
        if (maybeData == null && hasSomeRunIds) {
          return <Loading />;
        }
        if (maybeData == null) {
          return null;
        }
        const { span, content, toolCalls } = maybeData;
        const hasSpan = span != null;
        const spanControls: ReactNode[] = [];
        if (hasSpan) {
          spanControls.push(
            <TooltipTrigger>
              <Button
                variant="default"
                size="compact"
                aria-label="View run trace"
                icon={<Icon svg={<Icons.Trace />} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startTransition(() => {
                    setDialog(
                      <PlaygroundRunTraceDetailsDialog
                        traceId={span.context.traceId}
                        projectId={span.project.id}
                        title={`Experiment Run Trace`}
                      />
                    );
                  });
                }}
              />
              <Tooltip>View Trace</Tooltip>
            </TooltipTrigger>
          );
          spanControls.push(
            <TooltipTrigger>
              <Button
                variant="default"
                size="compact"
                aria-label="Annotate span"
                icon={<Icon svg={<Icons.EditOutline />} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startTransition(() => {
                    setDialog(
                      <EditSpanAnnotationsDialog
                        spanNodeId={span.id}
                        projectId={span.project.id}
                      />
                    );
                  });
                }}
              />
              <Tooltip>Annotate</Tooltip>
            </TooltipTrigger>
          );
        }
        return (
          <CellWithControlsWrap controls={spanControls}>
            <Flex direction={"column"} gap={"size-200"}>
              <Text>{content}</Text>
              {toolCalls != null
                ? Object.values(toolCalls).map((toolCall) =>
                    toolCall == null ? null : (
                      <PlaygroundToolCall
                        key={toolCall.id}
                        toolCall={toolCall}
                      />
                    )
                  )
                : null}
              {hasSpan ? <SpanMetadata span={span} /> : null}
            </Flex>
          </CellWithControlsWrap>
        );
      },
      minSize: 500,
    }));
  }, [hasSomeRunIds, exampleResponsesMap, instances]);
  const columns: ColumnDef<TableRow>[] = [
    {
      header: "input",
      accessorKey: "input",
      cell: (props) => JSONCell({ ...props, collapseSingleKey: false }),
      maxSize: 400,
      minSize: 200,
    },
    {
      header: "reference output",
      accessorKey: "output",
      cell: (props) => JSONCell({ ...props, collapseSingleKey: true }),
      maxSize: 400,
      minSize: 200,
    },
    ...playgroundInstanceOutputColumns,
  ];
  const table = useReactTable<TableRow>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
  });
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (containerRefElement) {
        const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
        // once the user has scrolled within 300px of the bottom of the table, fetch more data if there is any
        if (
          scrollHeight - scrollTop - clientHeight < 300 &&
          !isLoadingNext &&
          hasNext
        ) {
          loadNext(PAGE_SIZE);
        }
      }
    },
    [hasNext, isLoadingNext, loadNext]
  );

  /**
   * Instead of calling `column.getSize()` on every render for every header
   * and especially every data cell (very expensive),
   * we will calculate all column sizes at once at the root table level in a useMemo
   * and pass the column sizes down as CSS variables to the <table> element.
   */
  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.getState().columnSizingInfo, table.getState().columnSizing]);

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
        table {
          min-width: 100%;
        }
      `}
      ref={tableContainerRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
    >
      <table
        css={(theme) => css(tableCSS(theme), borderedTableCSS)}
        style={{
          ...columnSizeVars,
          width: table.getTotalSize(),
          minWidth: "100%",
        }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={{
                    width: `calc(var(--header-${header?.id}-size) * 1px)`,
                  }}
                >
                  <div>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </div>
                  <div
                    {...{
                      onMouseDown: header.getResizeHandler(),
                      onTouchStart: header.getResizeHandler(),
                      className: `resizer ${
                        header.column.getIsResizing() ? "isResizing" : ""
                      }`,
                    }}
                  />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {isEmpty ? (
          <TableEmpty />
        ) : table.getState().columnSizingInfo.isResizingColumn ? (
          <MemoizedTableBody table={table} />
        ) : (
          <TableBody table={table} />
        )}
      </table>
      <DialogContainer
        isDismissable
        type="slideOver"
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </div>
  );
}

graphql`
  subscription PlaygroundDatasetExamplesTableSubscription(
    $input: ChatCompletionOverDatasetInput!
  ) {
    chatCompletionOverDataset(input: $input) {
      __typename
      ... on TextChunk {
        content
        datasetExampleId
      }
      ... on ToolCallChunk {
        id
        datasetExampleId
        function {
          name
          arguments
        }
      }
      ... on ChatCompletionSubscriptionExperiment {
        experiment {
          id
        }
      }
      ... on ChatCompletionSubscriptionResult {
        datasetExampleId
        span {
          id
          tokenCountCompletion
          tokenCountPrompt
          tokenCountTotal
          latencyMs
          project {
            id
          }
          context {
            traceId
          }
        }
      }
      ... on ChatCompletionSubscriptionError {
        datasetExampleId
        message
      }
    }
  }
`;
