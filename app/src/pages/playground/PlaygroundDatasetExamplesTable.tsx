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
  useMutation,
  usePaginationFragment,
  useRelayEnvironment,
} from "react-relay";
import { useNavigate } from "react-router";
import {
  CellContext,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import {
  GraphQLSubscriptionConfig,
  PayloadError,
  requestSubscription,
} from "relay-runtime";
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
import PlaygroundDatasetExamplesTableMutation, {
  PlaygroundDatasetExamplesTableMutation as PlaygroundDatasetExamplesTableMutationType,
  PlaygroundDatasetExamplesTableMutation$data,
} from "./__generated__/PlaygroundDatasetExamplesTableMutation.graphql";
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
type ChatCompletionSubscriptionResult = Extract<
  PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
  { __typename: "ChatCompletionSubscriptionResult" }
>;
type ChatCompletionOverDatasetMutationPayload = Extract<
  PlaygroundDatasetExamplesTableMutation$data["chatCompletionOverDataset"],
  { __typename: "ChatCompletionOverDatasetMutationPayload" }
>;

type ChatCompletionSubscriptionError = Extract<
  PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
  { __typename: "ChatCompletionSubscriptionError" }
>;

type Span = NonNullable<ChatCompletionSubscriptionResult["span"]>;
type ToolCallChunk = Extract<
  PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
  { __typename: "ToolCallChunk" }
>;
type TextChunk = Extract<
  PlaygroundDatasetExamplesTableSubscription$data["chatCompletionOverDataset"],
  { __typename: "TextChunk" }
>;

type ExampleRunData = {
  content?: string | null;
  toolCalls?: Record<string, PartialOutputToolCall | undefined>;
  span?: Span | null;
  errorMessage?: string;
};

type InstanceToExampleResponsesMap = Record<
  InstanceId,
  Record<ExampleId, ExampleRunData | undefined> | undefined
>;

type TableRow = {
  id: string;
};

const getInitialExampleResponsesMap = (instances: PlaygroundInstance[]) => {
  return instances.reduce((acc, instance) => {
    return {
      ...acc,
      [instance.id]: {},
    };
  }, {});
};

/**
 * Updates an examples response for a particular instance. Takes in the current map and applies the chunk to it returning a new map.
 */
const updateExampleResponsesMap = ({
  instanceId,
  response,
  currentMap,
}: {
  instanceId: number;
  response:
    | ChatCompletionSubscriptionResult
    | TextChunk
    | ToolCallChunk
    | ChatCompletionSubscriptionError;
  currentMap: InstanceToExampleResponsesMap;
}): InstanceToExampleResponsesMap => {
  const exampleId = response.datasetExampleId;
  if (exampleId == null) {
    return currentMap;
  }
  const existingInstanceResponses = currentMap[instanceId];
  const existingExampleResponse = existingInstanceResponses?.[exampleId] ?? {};
  switch (response.__typename) {
    case "ChatCompletionSubscriptionResult": {
      const newInstanceExampleResponseMap = {
        ...existingInstanceResponses,
        [exampleId]: {
          ...existingExampleResponse,
          span: response.span,
        },
      };
      return {
        ...currentMap,
        [instanceId]: newInstanceExampleResponseMap,
      };
    }
    case "TextChunk": {
      const newInstanceExampleResponseMap = {
        ...existingInstanceResponses,
        [exampleId]: {
          ...existingExampleResponse,
          content: (existingExampleResponse?.content ?? "") + response.content,
        },
      };
      return {
        ...currentMap,
        [instanceId]: newInstanceExampleResponseMap,
      };
    }
    case "ToolCallChunk": {
      const { id, function: toolFunction } = response;
      const existingToolCalls = existingExampleResponse.toolCalls ?? {};
      const existingToolCall = existingToolCalls[id];
      const updatedToolCall: PartialOutputToolCall = {
        ...existingToolCall,
        id,
        function: {
          name: existingToolCall?.function?.name ?? toolFunction.name,
          arguments:
            existingToolCall?.function.arguments != null
              ? existingToolCall.function.arguments + toolFunction.arguments
              : toolFunction.arguments,
        },
      };
      const newInstanceExampleResponseMap = {
        ...existingInstanceResponses,
        [exampleId]: {
          ...existingExampleResponse,
          toolCalls: {
            ...existingToolCalls,
            [id]: updatedToolCall,
          },
        },
      };
      return {
        ...currentMap,
        [instanceId]: newInstanceExampleResponseMap,
      };
    }
    case "ChatCompletionSubscriptionError": {
      const { message } = response;
      const newInstanceExampleResponseMap = {
        ...existingInstanceResponses,
        [exampleId]: {
          ...existingExampleResponse,
          errorMessage: message,
        },
      };
      return {
        ...currentMap,
        [instanceId]: newInstanceExampleResponseMap,
      };
    }
    default:
      return assertUnreachable(response);
  }
};

const updateExampleResponsesMapFromMutationResponse = ({
  instanceId,
  response,
  currentMap,
}: {
  instanceId: number;
  response: ChatCompletionOverDatasetMutationPayload;
  currentMap: InstanceToExampleResponsesMap;
}): InstanceToExampleResponsesMap => {
  const instanceResponses: Record<string, ExampleRunData | undefined> = {};
  for (const example of response.examples) {
    const { datasetExampleId, result } = example;
    switch (result.__typename) {
      case "ChatCompletionMutationError": {
        instanceResponses[datasetExampleId] = {
          errorMessage: result.message,
        };
        break;
      }
      case "ChatCompletionMutationPayload": {
        const { content, span, toolCalls } = result;
        instanceResponses[datasetExampleId] = {
          content: content,
          toolCalls: toolCalls.reduce<Record<string, PartialOutputToolCall>>(
            (map, toolCall) => {
              map[toolCall.id] = toolCall;
              return map;
            },
            {}
          ),
          span,
        };
        break;
      }
      case "%other":
        break;
      default:
        assertUnreachable(result);
    }
  }
  return {
    ...currentMap,
    [instanceId]: instanceResponses,
  };
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

function ExampleOutputCell({
  exampleData,
  isRunning,
  setDialog,
}: {
  exampleData: ExampleRunData | null;
  isRunning: boolean;
  setDialog(dialog: ReactNode): void;
}) {
  if (exampleData == null && isRunning) {
    return <Loading />;
  }
  if (exampleData == null) {
    return null;
  }
  const { span, content, toolCalls, errorMessage } = exampleData;
  const hasSpan = span != null;
  let spanControls: ReactNode = null;
  if (hasSpan) {
    spanControls = (
      <>
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
      </>
    );
  }
  return (
    <CellWithControlsWrap controls={spanControls}>
      <Flex direction={"column"} gap={"size-200"}>
        {errorMessage != null ? (
          <Flex direction="row" gap="size-50" alignItems="center">
            <Icon svg={<Icons.AlertCircleOutline />} color="danger" />
            <Text color="danger">{errorMessage}</Text>
          </Flex>
        ) : null}
        <Text>{content}</Text>
        {toolCalls != null
          ? Object.values(toolCalls).map((toolCall) =>
              toolCall == null ? null : (
                <PlaygroundToolCall key={toolCall.id} toolCall={toolCall} />
              )
            )
          : null}
        {hasSpan ? <SpanMetadata span={span} /> : null}
      </Flex>
    </CellWithControlsWrap>
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
function TableBody({
  table,
  datasetId,
}: {
  table: Table<TableRow>;
  datasetId: string;
}) {
  const navigate = useNavigate();
  return (
    <tbody>
      {table.getRowModel().rows.map((row) => (
        <tr
          key={row.id}
          onClick={() => {
            navigate(
              `/playground/datasets/${datasetId}/examples/${row.original.id}`
            );
          }}
        >
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
          case "ChatCompletionSubscriptionExperiment":
            setExperimentId(chatCompletion.experiment.id);
            break;
          case "ChatCompletionSubscriptionResult":
          case "TextChunk":
          case "ChatCompletionSubscriptionError":
          case "ToolCallChunk": {
            setExampleResponsesMap((exampleResponsesMap) => {
              return updateExampleResponsesMap({
                instanceId,
                response: chatCompletion,
                currentMap: exampleResponsesMap,
              });
            });
            break;
          }
          // This should never happen
          // As relay puts it in generated files "This will never be '%other', but we need some value in case none of the concrete values match."
          case "%other":
            return;
          default:
            return assertUnreachable(chatCompletion);
        }
      },
    [setExperimentId]
  );

  const [generateChatCompletion] =
    useMutation<PlaygroundDatasetExamplesTableMutationType>(
      PlaygroundDatasetExamplesTableMutation
    );

  const onCompleted = useCallback(
    (instanceId: number) =>
      (
        response: PlaygroundDatasetExamplesTableMutation$data,
        errors: PayloadError[] | null
      ) => {
        markPlaygroundInstanceComplete(instanceId);
        if (errors) {
          notifyError({
            title: "Chat completion failed",
            message: errors[0].message,
          });
          return;
        }
        setExperimentId(response.chatCompletionOverDataset.experimentId);
        setExampleResponsesMap((exampleResponsesMap) => {
          return updateExampleResponsesMapFromMutationResponse({
            instanceId,
            response: response.chatCompletionOverDataset,
            currentMap: exampleResponsesMap,
          });
        });
      },
    [markPlaygroundInstanceComplete, notifyError, setExperimentId]
  );

  useEffect(() => {
    if (!hasSomeRunIds) {
      return;
    }
    const { instances, streaming, setExperimentId } =
      playgroundStore.getState();
    setExperimentId(null);
    setExampleResponsesMap(getInitialExampleResponsesMap(instances));
    if (streaming) {
      const subscriptions: Disposable[] = [];
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
    } else {
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
        generateChatCompletion({
          variables,
          onCompleted: onCompleted(instance.id),
          onError(error) {
            markPlaygroundInstanceComplete(instance.id);
            notifyError({
              title: "Failed to get output",
              message: error.message,
            });
          },
        });
      }
    }
  }, [
    credentials,
    datasetId,
    environment,
    generateChatCompletion,
    hasSomeRunIds,
    markPlaygroundInstanceComplete,
    notifyError,
    onCompleted,
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
  const tableData = useMemo<TableRow[]>(
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

  const playgroundInstanceOutputColumns = useMemo((): ColumnDef<TableRow>[] => {
    return instances.map((instance, index) => ({
      id: `instance ${instance.id}`,
      header: () => (
        <Flex direction="row" gap="size-100" alignItems="center">
          <AlphabeticIndexIcon index={index} />
          <span>Output</span>
        </Flex>
      ),

      cell: ({ row }) => {
        const exampleData =
          exampleResponsesMap[instance.id]?.[row.original.id] ?? null;
        return (
          <ExampleOutputCell
            exampleData={exampleData}
            isRunning={hasSomeRunIds}
            setDialog={setDialog}
          />
        );
      },
      size: 500,
    }));
  }, [exampleResponsesMap, hasSomeRunIds, instances]);

  const columns: ColumnDef<TableRow>[] = [
    {
      header: "input",
      accessorKey: "input",
      cell: (props) => JSONCell({ ...props, collapseSingleKey: false }),
      size: 200,
    },
    {
      header: "reference output",
      accessorKey: "output",
      cell: (props) => JSONCell({ ...props, collapseSingleKey: true }),
      size: 200,
    },
    ...playgroundInstanceOutputColumns,
    { id: "tail", size: 700, minSize: 700 },
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
  }, [
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().columnSizingInfo,
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().columnSizing,
    columns.length,
  ]);

  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
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
          <MemoizedTableBody table={table} datasetId={datasetId} />
        ) : (
          <TableBody table={table} datasetId={datasetId} />
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

graphql`
  mutation PlaygroundDatasetExamplesTableMutation(
    $input: ChatCompletionOverDatasetInput!
  ) {
    chatCompletionOverDataset(input: $input) {
      __typename
      experimentId
      examples {
        datasetExampleId
        result {
          __typename
          ... on ChatCompletionMutationError {
            message
          }
          ... on ChatCompletionMutationPayload {
            content
            errorMessage
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
            toolCalls {
              id
              function {
                name
                arguments
              }
            }
          }
        }
      }
    }
  }
`;
