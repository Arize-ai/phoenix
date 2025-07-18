import React, {
  memo,
  PropsWithChildren,
  ReactNode,
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
import { useSearchParams } from "react-router";
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

import { DialogContainer } from "@arizeai/components";

import {
  DialogTrigger,
  Flex,
  Icon,
  IconButton,
  Icons,
  Loading,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { JSONText } from "@phoenix/components/code/JSONText";
import { CellTop } from "@phoenix/components/table";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/tooltip";
import { SpanTokenCosts } from "@phoenix/components/trace";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { useNotifyError } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { assertUnreachable, isStringKeyedObject } from "@phoenix/typeUtils";
import {
  getErrorMessagesFromRelayMutationError,
  getErrorMessagesFromRelaySubscriptionError,
} from "@phoenix/utils/errorUtils";

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
import {
  ExampleRunData,
  InstanceResponses,
  usePlaygroundDatasetExamplesTableContext,
} from "./PlaygroundDatasetExamplesTableContext";
import { PlaygroundErrorWrap } from "./PlaygroundErrorWrap";
import { PlaygroundExperimentRunDetailsDialog } from "./PlaygroundExperimentRunDetailsDialog";
import { PlaygroundRunTraceDetailsDialog } from "./PlaygroundRunTraceDialog";
import {
  PartialOutputToolCall,
  PlaygroundToolCall,
} from "./PlaygroundToolCall";
import {
  denormalizePlaygroundInstance,
  extractVariablesFromInstance,
  getChatCompletionOverDatasetInput,
} from "./playgroundUtils";

const PAGE_SIZE = 10;

type ChatCompletionOverDatasetMutationPayload = Extract<
  PlaygroundDatasetExamplesTableMutation$data["chatCompletionOverDataset"],
  { __typename: "ChatCompletionOverDatasetMutationPayload" }
>;

const createExampleResponsesForInstance = (
  response: ChatCompletionOverDatasetMutationPayload
): InstanceResponses => {
  return response.examples.reduce<InstanceResponses>(
    (instanceResponses, example) => {
      const { datasetExampleId, result, experimentRunId } = example;
      const baseExampleResponseData: ExampleRunData = {
        experimentRunId,
      };
      switch (result.__typename) {
        case "ChatCompletionMutationError": {
          return {
            ...instanceResponses,
            [datasetExampleId]: {
              ...baseExampleResponseData,
              errorMessage: result.message,
            },
          };
        }
        case "ChatCompletionMutationPayload": {
          const { errorMessage, content, span, toolCalls } = result;
          return {
            ...instanceResponses,
            [datasetExampleId]: {
              ...baseExampleResponseData,
              span,
              content,
              errorMessage,
              toolCalls: toolCalls.reduce<
                Record<string, PartialOutputToolCall>
              >((map, toolCall) => {
                map[toolCall.id] = toolCall;
                return map;
              }, {}),
            },
          };
        }
        case "%other":
          return instanceResponses;
        default:
          assertUnreachable(result);
      }
    },
    {}
  );
};

const cellWithControlsWrapCSS = css`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  height: 100%;
  min-height: 75px;
  .controls {
    transition: opacity 0.2s ease-in-out;
    opacity: 0;
    display: none;
    z-index: 1;
  }
  &:hover .controls {
    opacity: 1;
    display: flex;
    // make them stand out
    button {
      border-color: var(--ac-global-color-primary);
    }
  }
`;

const cellControlsCSS = css`
  position: absolute;
  top: calc(-1 * var(--ac-global-dimension-static-size-200));
  right: var(--ac-global-dimension-static-size-100);
  display: flex;
  flex-direction: row;
  gap: var(--ac-global-dimension-static-size-100);
`;

/**
 * Wraps a cell to provides space for controls that are shown on hover.
 */
export function CellWithControlsWrap(
  props: PropsWithChildren<{ controls: ReactNode }>
) {
  return (
    <div css={cellWithControlsWrapCSS}>
      {props.children}
      <div css={cellControlsCSS} className="controls">
        {props.controls}
      </div>
    </div>
  );
}

function LargeTextWrap({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="large-text-wrap"
      css={css`
        max-height: 300px;
        overflow-y: auto;
        padding: var(--ac-global-dimension-static-size-200);
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

function EmptyExampleOutput({
  isRunning,
  instanceVariables,
  datasetExampleInput,
}: {
  isRunning: boolean;
  instanceVariables: string[];
  datasetExampleInput: unknown;
}) {
  const missingVariables = useMemo(() => {
    const parsedDatasetExampleInput = isStringKeyedObject(datasetExampleInput)
      ? datasetExampleInput
      : {};

    return instanceVariables.filter((variable) => {
      return parsedDatasetExampleInput[variable] == null;
    });
  }, [datasetExampleInput, instanceVariables]);
  if (isRunning) {
    return <Loading />;
  }

  if (missingVariables.length === 0) {
    return null;
  }
  return (
    <PlaygroundErrorWrap>
      {`Missing input for variable${missingVariables.length > 1 ? "s" : ""}: ${missingVariables.join(
        ", "
      )}`}
    </PlaygroundErrorWrap>
  );
}

function ExampleOutputContent({
  exampleData,
}: {
  exampleData: ExampleRunData;
}) {
  const { span, content, toolCalls, errorMessage, experimentRunId } =
    exampleData;
  const hasSpan = span != null;
  const hasExperimentRun = experimentRunId != null;
  const spanControls = useMemo(() => {
    if (hasSpan || hasExperimentRun) {
      return (
        <>
          {hasExperimentRun && (
            <DialogTrigger>
              <TooltipTrigger>
                <IconButton size="S" aria-label="View experiment run details">
                  <Icon svg={<Icons.ExpandOutline />} />
                </IconButton>
                <Tooltip>
                  <TooltipArrow />
                  view experiment run
                </Tooltip>
              </TooltipTrigger>
              <ModalOverlay>
                <Modal variant="slideover" size="L">
                  <PlaygroundExperimentRunDetailsDialog
                    runId={experimentRunId}
                  />
                </Modal>
              </ModalOverlay>
            </DialogTrigger>
          )}
          {hasSpan && (
            <>
              <DialogTrigger>
                <TooltipTrigger>
                  <IconButton size="S" aria-label="View run trace">
                    <Icon svg={<Icons.Trace />} />
                  </IconButton>
                  <Tooltip>
                    <TooltipArrow />
                    view run trace
                  </Tooltip>
                </TooltipTrigger>
                <ModalOverlay>
                  <Modal size="fullscreen" variant="slideover">
                    <PlaygroundRunTraceDetailsDialog
                      traceId={span.context.traceId}
                      projectId={span.project.id}
                      title={`Experiment Run Trace`}
                    />
                  </Modal>
                </ModalOverlay>
              </DialogTrigger>
            </>
          )}
        </>
      );
    }
  }, [experimentRunId, hasExperimentRun, hasSpan, span]);

  return (
    <Flex direction="column" height="100%">
      <CellTop extra={spanControls}>
        {span ? (
          <Flex
            direction="row"
            gap="size-100"
            alignItems="center"
            height="100%"
          >
            <LatencyText latencyMs={span.latencyMs || 0} size="S" />
            <SpanTokenCount
              tokenCountTotal={span.tokenCountTotal || 0}
              nodeId={span.id}
            />
            <SpanTokenCosts
              totalCost={span.costSummary?.total?.cost || 0}
              spanNodeId={span.id}
            />
          </Flex>
        ) : (
          <Text color="text-500" fontStyle="italic">
            generating...
          </Text>
        )}
      </CellTop>
      <View padding="size-200">
        <Flex direction={"column"} gap="size-100" key="content-wrap">
          {errorMessage != null ? (
            <PlaygroundErrorWrap key="error-message">
              {errorMessage}
            </PlaygroundErrorWrap>
          ) : null}
          {content != null ? <Text key="content">{content}</Text> : null}
          {toolCalls != null
            ? Object.values(toolCalls).map((toolCall) =>
                toolCall == null ? null : (
                  <PlaygroundToolCall key={toolCall.id} toolCall={toolCall} />
                )
              )
            : null}
        </Flex>
      </View>
    </Flex>
  );
}

const MemoizedExampleOutputCell = memo(function ExampleOutputCell({
  isRunning,
  instanceId,
  exampleId,
  instanceVariables,
  datasetExampleInput,
}: {
  instanceId: number;
  exampleId: string;
  isRunning: boolean;
  instanceVariables: string[];
  datasetExampleInput: unknown;
}) {
  const exampleData = usePlaygroundDatasetExamplesTableContext(
    (state) => state.exampleResponsesMap[instanceId]?.[exampleId]
  );

  return exampleData == null ? (
    <EmptyExampleOutput
      isRunning={isRunning}
      instanceVariables={instanceVariables}
      datasetExampleInput={datasetExampleInput}
    />
  ) : (
    <ExampleOutputContent exampleData={exampleData} />
  );
});

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
                  padding: 0,
                  verticalAlign: "top",
                  width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                  maxWidth: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                  minWidth: 0,
                  // allow long text with no symbols or spaces to wrap
                  // otherwise, it will prevent the cell from shrinking
                  // an alternative solution would be to set a max-width and allow
                  // the cell to scroll itself
                  wordBreak: "break-all",
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
  const allInstanceMessages = usePlaygroundContext(
    (state) => state.allInstanceMessages
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);

  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const updateExampleData = usePlaygroundDatasetExamplesTableContext(
    (state) => state.updateExampleData
  );
  const setExampleDataForInstance = usePlaygroundDatasetExamplesTableContext(
    (state) => state.setExampleDataForInstance
  );
  const resetExampleData = usePlaygroundDatasetExamplesTableContext(
    (state) => state.resetExampleData
  );
  const appendExampleDataToolCallChunk =
    usePlaygroundDatasetExamplesTableContext(
      (state) => state.appendExampleDataToolCallChunk
    );
  const appendExampleDataTextChunk = usePlaygroundDatasetExamplesTableContext(
    (state) => state.appendExampleDataTextChunk
  );

  const [dialog, setDialog] = useState<ReactNode>(null);
  const [, setSearchParams] = useSearchParams();
  const hasSomeRunIds = instances.some(
    (instance) => instance.activeRunId !== null
  );

  const credentials = useCredentialsContext((state) => state);
  const markPlaygroundInstanceComplete = usePlaygroundContext(
    (state) => state.markPlaygroundInstanceComplete
  );
  const playgroundStore = usePlaygroundStore();

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
            updateInstance({
              instanceId,
              patch: { experimentId: chatCompletion.experiment.id },
              dirty: null,
            });
            break;
          case "ChatCompletionSubscriptionResult":
            if (chatCompletion.datasetExampleId == null) {
              return;
            }
            updateExampleData({
              instanceId,
              exampleId: chatCompletion.datasetExampleId,
              patch: {
                span: chatCompletion.span,
                experimentRunId: chatCompletion.experimentRun?.id,
              },
            });
            break;
          case "ChatCompletionSubscriptionError":
            if (chatCompletion.datasetExampleId == null) {
              return;
            }
            updateExampleData({
              instanceId,
              exampleId: chatCompletion.datasetExampleId,
              patch: { errorMessage: chatCompletion.message },
            });
            break;
          case "TextChunk":
            if (chatCompletion.datasetExampleId == null) {
              return;
            }
            appendExampleDataTextChunk({
              instanceId,
              exampleId: chatCompletion.datasetExampleId,
              textChunk: chatCompletion.content,
            });
            break;
          case "ToolCallChunk": {
            if (chatCompletion.datasetExampleId == null) {
              return;
            }
            appendExampleDataToolCallChunk({
              instanceId,
              exampleId: chatCompletion.datasetExampleId,
              toolCallChunk: chatCompletion,
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
    [
      appendExampleDataTextChunk,
      appendExampleDataToolCallChunk,
      updateExampleData,
      updateInstance,
    ]
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
        updateInstance({
          instanceId,
          patch: {
            experimentId: response.chatCompletionOverDataset.experimentId,
          },
          dirty: null,
        });
        setExampleDataForInstance({
          instanceId,
          data: createExampleResponsesForInstance(
            response.chatCompletionOverDataset
          ),
        });
      },
    [
      markPlaygroundInstanceComplete,
      notifyError,
      setExampleDataForInstance,
      updateInstance,
    ]
  );

  useEffect(() => {
    if (!hasSomeRunIds) {
      return;
    }
    const { instances, streaming, updateInstance } = playgroundStore.getState();
    resetExampleData();
    if (streaming) {
      const subscriptions: Disposable[] = [];
      for (const instance of instances) {
        const { activeRunId } = instance;
        updateInstance({
          instanceId: instance.id,
          patch: { experimentId: null },
          dirty: null,
        });
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
              markPlaygroundInstanceComplete(instance.id);
              const errorMessages =
                getErrorMessagesFromRelaySubscriptionError(error);
              if (errorMessages != null && errorMessages.length > 0) {
                notifyError({
                  title: "Failed to get output",
                  message: errorMessages.join("\n"),
                  expireMs: 10000,
                });
              } else {
                notifyError({
                  title: "Failed to get output",
                  message: error.message,
                  expireMs: 10000,
                });
              }
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
      const disposables: Disposable[] = [];
      for (const instance of instances) {
        const { activeRunId } = instance;
        if (activeRunId === null) {
          continue;
        }
        updateInstance({
          instanceId: instance.id,
          patch: { experimentId: null },
          dirty: null,
        });
        const variables = {
          input: getChatCompletionOverDatasetInput({
            credentials,
            instanceId: instance.id,
            playgroundStore,
            datasetId,
          }),
        };
        const disposable = generateChatCompletion({
          variables,
          onCompleted: onCompleted(instance.id),
          onError(error) {
            markPlaygroundInstanceComplete(instance.id);
            const errorMessages = getErrorMessagesFromRelayMutationError(error);
            if (errorMessages != null && errorMessages.length > 0) {
              notifyError({
                title: "Failed to get output",
                message: errorMessages.join("\n"),
                expireMs: 10000,
              });
            } else {
              notifyError({
                title: "Failed to get output",
                message: error.message,
                expireMs: 10000,
              });
            }
          },
        });
        disposables.push(disposable);
      }
      return () => {
        for (const disposable of disposables) {
          disposable.dispose();
        }
      };
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
    resetExampleData,
  ]);

  const { dataset } = useLazyLoadQuery<PlaygroundDatasetExamplesTableQuery>(
    graphql`
      query PlaygroundDatasetExamplesTableQuery($datasetId: ID!) {
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
        datasetVersionId: { type: "ID" }
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 20 }
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
    return instances.map((instance, index) => {
      const enrichedInstance = denormalizePlaygroundInstance(
        instance,
        allInstanceMessages
      );
      const instanceVariables = extractVariablesFromInstance({
        instance: enrichedInstance,
        templateFormat,
      });
      return {
        id: `instance-${instance.id}`,
        header: () => (
          <Flex direction="row" gap="size-100" alignItems="center">
            <AlphabeticIndexIcon index={index} />
            <span>Output</span>
          </Flex>
        ),

        cell: ({ row }) => {
          return (
            <MemoizedExampleOutputCell
              instanceId={instance.id}
              exampleId={row.original.id}
              isRunning={hasSomeRunIds}
              instanceVariables={instanceVariables}
              datasetExampleInput={row.original.input}
            />
          );
        },
        size: 500,
      };
    });
  }, [hasSomeRunIds, instances, templateFormat, allInstanceMessages]);

  const columns: ColumnDef<TableRow>[] = [
    {
      header: "input",
      accessorKey: "input",
      cell: ({ row }) => {
        return (
          <>
            <CellTop
              extra={
                <TooltipTrigger>
                  <IconButton
                    size="S"
                    aria-label="View example details"
                    onPress={() => {
                      setSearchParams((prev) => {
                        prev.set("exampleId", row.original.id);
                        return prev;
                      });
                    }}
                  >
                    <Icon svg={<Icons.ExpandOutline />} />
                  </IconButton>
                  <Tooltip>
                    <TooltipArrow />
                    view example
                  </Tooltip>
                </TooltipTrigger>
              }
            >
              <Text
                color="text-500"
                css={css`
                  white-space: nowrap;
                `}
              >{`Example ${row.original.id}`}</Text>
            </CellTop>
            <LargeTextWrap>
              <JSONText
                json={row.original.input}
                disableTitle
                space={2}
                collapseSingleKey={false}
              />
            </LargeTextWrap>
          </>
        );
      },
      size: 200,
    },
    {
      header: "reference output",
      accessorKey: "output",
      cell: (props) => {
        return (
          <>
            <CellTop>
              <Text color="text-500">{`reference output`}</Text>
            </CellTop>
            <JSONCell {...props} collapseSingleKey={true} />
          </>
        );
      },
      size: 200,
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
   * @see https://tanstack.com/table/v8/docs/framework/react/examples/column-resizing-performant
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
        height: 100%;
      `}
      ref={tableContainerRef}
      onScroll={(e) => fetchMoreOnBottomReached(e.target as HTMLDivElement)}
    >
      <table
        css={css(tableCSS, borderedTableCSS)}
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
          setSearchParams((searchParams) => {
            searchParams.delete(SELECTED_SPAN_NODE_ID_PARAM);
            return searchParams;
          });
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
          tokenCountTotal
          costSummary {
            total {
              cost
            }
          }
          latencyMs
          project {
            id
          }
          context {
            traceId
          }
        }
        experimentRun {
          id
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
        experimentRunId
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
              tokenCountTotal
              costSummary {
                total {
                  cost
                }
              }
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
