"use no memo";
import {
  memo,
  SetStateAction,
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
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Table,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import {
  GraphQLSubscriptionConfig,
  PayloadError,
  requestSubscription,
} from "relay-runtime";
import { css } from "@emotion/react";

import {
  Flex,
  Icon,
  IconButton,
  Icons,
  Modal,
  ModalOverlay,
  ParagraphSkeleton,
  Text,
  View,
} from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { JSONText } from "@phoenix/components/code/JSONText";
import { ExperimentRunCellAnnotationsList } from "@phoenix/components/experiment";
import {
  CellTop,
  JSONCell,
  LargeTextWrap,
  PaddedCell,
} from "@phoenix/components/table";
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
import {
  assertUnreachable,
  isStringArray,
  isStringKeyedObject,
} from "@phoenix/typeUtils";
import {
  getErrorMessagesFromRelayMutationError,
  getErrorMessagesFromRelaySubscriptionError,
} from "@phoenix/utils/errorUtils";

import { ExperimentCompareDetailsDialog } from "../experiment/ExperimentCompareDetailsDialog";
import { ExperimentRepetitionSelector } from "../experiment/ExperimentRepetitionSelector";

import type { PlaygroundDatasetExamplesTableFragment$key } from "./__generated__/PlaygroundDatasetExamplesTableFragment.graphql";
import {
  PlaygroundDatasetExamplesTableMutation as PlaygroundDatasetExamplesTableMutationType,
  PlaygroundDatasetExamplesTableMutation$data,
} from "./__generated__/PlaygroundDatasetExamplesTableMutation.graphql";
import { PlaygroundDatasetExamplesTableQuery } from "./__generated__/PlaygroundDatasetExamplesTableQuery.graphql";
import { PlaygroundDatasetExamplesTableRefetchQuery } from "./__generated__/PlaygroundDatasetExamplesTableRefetchQuery.graphql";
import PlaygroundDatasetExamplesTableSubscription, {
  EvaluatorInputMappingInput,
  PlaygroundDatasetExamplesTableSubscription as PlaygroundDatasetExamplesTableSubscriptionType,
  PlaygroundDatasetExamplesTableSubscription$data,
} from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";
import {
  ExampleRunData,
  InstanceResponses,
  usePlaygroundDatasetExamplesTableContext,
} from "./PlaygroundDatasetExamplesTableContext";
import { PlaygroundErrorWrap } from "./PlaygroundErrorWrap";
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

type ChatCompletionOverDatasetMutationPayload =
  PlaygroundDatasetExamplesTableMutation$data["chatCompletionOverDataset"];

const createExampleResponsesForInstance = (
  response: ChatCompletionOverDatasetMutationPayload
): InstanceResponses => {
  return response.examples.reduce<InstanceResponses>(
    (instanceResponses, example) => {
      const {
        datasetExampleId,
        repetitionNumber,
        experimentRunId,
        repetition,
      } = example;
      const { errorMessage, content, span, toolCalls, evaluations } =
        repetition;
      const updatedInstanceResponses: InstanceResponses = {
        ...instanceResponses,
        [datasetExampleId]: {
          ...instanceResponses[datasetExampleId],
          [repetitionNumber]: {
            ...instanceResponses[datasetExampleId]?.[repetitionNumber],
            experimentRunId,
            span,
            content,
            errorMessage,
            toolCalls: toolCalls.reduce<Record<string, PartialOutputToolCall>>(
              (map, toolCall) => {
                map[toolCall.id] = toolCall;
                return map;
              },
              {}
            ),
            evaluations: [...evaluations],
          },
        },
      };
      return updatedInstanceResponses;
    },
    {}
  );
};

function EmptyExampleOutput({
  isRunning,
  instanceVariables,
  datasetExampleInput,
}: {
  isRunning: boolean;
  instanceVariables: string[];
  datasetExampleInput: unknown;
}) {
  const parsedDatasetExampleInput = useMemo(() => {
    return isStringKeyedObject(datasetExampleInput) ? datasetExampleInput : {};
  }, [datasetExampleInput]);

  const missingVariables = useMemo(() => {
    return instanceVariables.filter((variable) => {
      return parsedDatasetExampleInput[variable] == null;
    });
  }, [parsedDatasetExampleInput, instanceVariables]);
  let cellTopContent: ReactNode | null = <Text color="text-500">Ready</Text>;
  let content: ReactNode | null = (
    <Text color="text-500">Press run to generate</Text>
  );
  if (isRunning) {
    content = <ParagraphSkeleton lines={4} />;
    cellTopContent = <Text color="text-500">Queued</Text>;
  }
  if (missingVariables.length > 0) {
    cellTopContent = <Text color="danger">Missing variables</Text>;
    content = (
      <PlaygroundErrorWrap>
        {`Dataset is missing input for variable${missingVariables.length > 1 ? "s" : ""}: ${missingVariables.join(
          ", "
        )}.${
          Object.keys(parsedDatasetExampleInput).length > 0
            ? ` Possible inputs are: ${Object.keys(parsedDatasetExampleInput).join(", ")}`
            : " No inputs found in dataset example."
        }`}
      </PlaygroundErrorWrap>
    );
  }
  return (
    <>
      <CellTop>{cellTopContent}</CellTop>
      <View padding="size-200" key="content-wrap">
        {content}
      </View>
    </>
  );
}

function ExampleOutputContent({
  exampleData,
  repetitionNumber,
  setRepetitionNumber,
  totalRepetitions,
  onViewExperimentRunDetailsPress,
  onViewTracePress,
}: {
  exampleData: ExampleRunData;
  repetitionNumber: number;
  setRepetitionNumber: (n: SetStateAction<number>) => void;
  totalRepetitions: number;
  onViewExperimentRunDetailsPress: () => void;
  onViewTracePress: (
    traceId: string,
    projectId: string,
    evaluatorName?: string
  ) => void;
}) {
  const {
    span,
    content,
    toolCalls,
    errorMessage,
    experimentRunId,
    evaluations,
  } = exampleData;
  const hasSpan = span != null;
  const hasExperimentRun = experimentRunId != null;
  const spanControls = useMemo(() => {
    return (
      <>
        {totalRepetitions > 1 && (
          <ExperimentRepetitionSelector
            repetitionNumber={repetitionNumber}
            totalRepetitions={totalRepetitions}
            setRepetitionNumber={setRepetitionNumber}
          />
        )}
        <TooltipTrigger isDisabled={!hasExperimentRun}>
          <IconButton
            size="S"
            aria-label="View experiment run details"
            isDisabled={!hasExperimentRun}
            onPress={onViewExperimentRunDetailsPress}
          >
            <Icon svg={<Icons.ExpandOutline />} />
          </IconButton>
          <Tooltip>
            <TooltipArrow />
            view experiment run
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger isDisabled={!hasSpan}>
          <IconButton
            size="S"
            aria-label="View run trace"
            isDisabled={!hasSpan}
            onPress={() => {
              if (span) {
                onViewTracePress(span.context.traceId, span.project.id);
              }
            }}
          >
            <Icon svg={<Icons.Trace />} />
          </IconButton>
          <Tooltip>
            <TooltipArrow />
            view run trace
          </Tooltip>
        </TooltipTrigger>
      </>
    );
  }, [
    hasExperimentRun,
    hasSpan,
    repetitionNumber,
    setRepetitionNumber,
    span,
    totalRepetitions,
    onViewExperimentRunDetailsPress,
    onViewTracePress,
  ]);

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
            Generating...
          </Text>
        )}
      </CellTop>

      <Flex direction={"column"} gap="size-100" key="content-wrap">
        {errorMessage != null ? (
          <View padding="size-200" key="error-message-wrap">
            <PlaygroundErrorWrap key="error-message">
              {errorMessage}
            </PlaygroundErrorWrap>
          </View>
        ) : null}
        {content != null ? (
          <View padding="size-200" key="content-wrap">
            <LargeTextWrap key="content">{content}</LargeTextWrap>
          </View>
        ) : null}
        {toolCalls != null ? (
          <View padding="size-200" key="tool-calls-wrap">
            {Object.values(toolCalls).map((toolCall) =>
              toolCall == null ? null : (
                <PlaygroundToolCall key={toolCall.id} toolCall={toolCall} />
              )
            )}
          </View>
        ) : null}
      </Flex>
      {evaluations != null && evaluations.length > 0 && (
        <ExperimentRunCellAnnotationsList
          annotations={evaluations}
          onTraceClick={({ traceId, projectId, annotationName }) => {
            if (traceId && projectId) {
              onViewTracePress(traceId, projectId, annotationName);
            }
          }}
        />
      )}
    </Flex>
  );
}

const MemoizedExampleOutputCell = memo(function ExampleOutputCell({
  isRunning,
  instanceId,
  exampleId,
  instanceVariables,
  datasetExampleInput,
  onViewExperimentRunDetailsPress,
  onViewTracePress,
}: {
  instanceId: number;
  exampleId: string;
  isRunning: boolean;
  instanceVariables: string[];
  datasetExampleInput: unknown;
  onViewExperimentRunDetailsPress: () => void;
  onViewTracePress: (
    traceId: string,
    projectId: string,
    evaluatorName?: string
  ) => void;
}) {
  const [repetitionNumber, setRepetitionNumber] = useState(1);
  const totalRepetitions = usePlaygroundDatasetExamplesTableContext(
    (state) => state.repetitions
  );
  const examplesByRepetitionNumber = usePlaygroundDatasetExamplesTableContext(
    (store) => store.exampleResponsesMap[instanceId]?.[exampleId]
  );
  const exampleData = useMemo(() => {
    return examplesByRepetitionNumber?.[repetitionNumber];
  }, [examplesByRepetitionNumber, repetitionNumber]);
  return exampleData == null ? (
    <EmptyExampleOutput
      isRunning={isRunning}
      instanceVariables={instanceVariables}
      datasetExampleInput={datasetExampleInput}
    />
  ) : (
    <ExampleOutputContent
      exampleData={exampleData}
      repetitionNumber={repetitionNumber}
      totalRepetitions={totalRepetitions}
      setRepetitionNumber={setRepetitionNumber}
      onViewExperimentRunDetailsPress={onViewExperimentRunDetailsPress}
      onViewTracePress={onViewTracePress}
    />
  );
});

// un-memoized normal table body component - see memoized version below
function TableBody<T>({
  table,
  virtualizer,
}: {
  table: Table<T>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}) {
  "use no memo";
  const rows = table.getRowModel().rows;

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();
  const spacerRowHeight = useMemo(() => {
    return totalHeight - virtualRows.reduce((acc, item) => acc + item.size, 0);
  }, [totalHeight, virtualRows]);

  return (
    <tbody>
      {virtualRows.map((virtualRow, index) => {
        const row = rows[virtualRow.index];
        return (
          <tr
            key={row.id}
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${
                virtualRow.start - index * virtualRow.size
              }px)`,
            }}
          >
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
        );
      })}
      <tr>
        <td
          style={{
            height: `${spacerRowHeight}px`,
            padding: 0,
          }}
          colSpan={table.getAllColumns().length}
        />
      </tr>
    </tbody>
  );
}
// special memoized wrapper for our table body that we will use during column resizing
export const MemoizedTableBody = memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data
) as typeof TableBody;

export function PlaygroundDatasetExamplesTable({
  datasetId,
  splitIds,
  evaluatorMappings,
}: {
  datasetId: string;
  splitIds?: string[];
  /**
   * Record of evaluator id to input mappings
   */
  evaluatorMappings: Record<string, EvaluatorInputMappingInput>;
}) {
  const environment = useRelayEnvironment();
  const instances = usePlaygroundContext((state) => state.instances);
  const { baseExperimentId, compareExperimentIds } = useMemo(() => {
    const experimentIds = instances.map((instance) => instance.experimentId);
    const [baseExperimentId, ...compareExperimentIds] = experimentIds;
    return { baseExperimentId, compareExperimentIds };
  }, [instances]);
  const [selectedExampleIndex, setSelectedExampleIndex] = useState<
    number | null
  >(null);
  const [selectedTraceInfo, setSelectedTraceInfo] = useState<{
    traceId: string;
    projectId: string;
    evaluatorName?: string;
  } | null>(null);
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
  const resetData = usePlaygroundDatasetExamplesTableContext(
    (state) => state.resetData
  );
  const appendExampleDataToolCallChunk =
    usePlaygroundDatasetExamplesTableContext(
      (state) => state.appendExampleDataToolCallChunk
    );
  const appendExampleDataTextChunk = usePlaygroundDatasetExamplesTableContext(
    (state) => state.appendExampleDataTextChunk
  );
  const appendExampleDataEvaluationChunk =
    usePlaygroundDatasetExamplesTableContext(
      (state) => state.appendExampleDataEvaluationChunk
    );
  const setRepetitions = usePlaygroundDatasetExamplesTableContext(
    (state) => state.setRepetitions
  );
  const repetitions = usePlaygroundContext((state) => state.repetitions);

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
              repetitionNumber: chatCompletion.repetitionNumber ?? 1,
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
              repetitionNumber: chatCompletion.repetitionNumber ?? 1,
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
              repetitionNumber: chatCompletion.repetitionNumber ?? 1,
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
              repetitionNumber: chatCompletion.repetitionNumber ?? 1,
              toolCallChunk: chatCompletion,
            });
            break;
          }
          case "EvaluationChunk": {
            if (chatCompletion.datasetExampleId == null) {
              return;
            }
            const evaluation = chatCompletion.experimentRunEvaluation;
            if (evaluation == null) {
              return;
            }
            appendExampleDataEvaluationChunk({
              instanceId,
              exampleId: chatCompletion.datasetExampleId,
              repetitionNumber: chatCompletion.repetitionNumber ?? 1,
              evaluationChunk: evaluation,
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
      appendExampleDataEvaluationChunk,
      updateExampleData,
      updateInstance,
    ]
  );

  const [generateChatCompletion] =
    useMutation<PlaygroundDatasetExamplesTableMutationType>(graphql`
      mutation PlaygroundDatasetExamplesTableMutation(
        $input: ChatCompletionOverDatasetInput!
      ) {
        chatCompletionOverDataset(input: $input) {
          experimentId
          examples {
            datasetExampleId
            experimentRunId
            repetitionNumber
            repetition {
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
              evaluations {
                id
                name
                label
                score
                annotatorKind
                explanation
                metadata
                startTime
                trace {
                  traceId
                  projectId
                }
              }
            }
          }
        }
      }
    `);

  const onCompleted = useCallback(
    (instanceId: number) =>
      (
        response: PlaygroundDatasetExamplesTableMutation$data,
        errors: PayloadError[] | null
      ) => {
        markPlaygroundInstanceComplete(instanceId);
        setRepetitions(repetitions);
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
      repetitions,
      setExampleDataForInstance,
      setRepetitions,
      updateInstance,
    ]
  );

  useEffect(() => {
    if (!hasSomeRunIds) {
      return;
    }
    const { instances, streaming, updateInstance } = playgroundStore.getState();
    resetData();
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
            splitIds,
            evaluatorMappings,
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
        setRepetitions(repetitions);
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
            splitIds,
            evaluatorMappings,
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
    splitIds,
    environment,
    evaluatorMappings,
    generateChatCompletion,
    hasSomeRunIds,
    markPlaygroundInstanceComplete,
    notifyError,
    onCompleted,
    onNext,
    playgroundStore,
    repetitions,
    resetData,
    setRepetitions,
  ]);

  const { dataset } = useLazyLoadQuery<PlaygroundDatasetExamplesTableQuery>(
    graphql`
      query PlaygroundDatasetExamplesTableQuery(
        $datasetId: ID!
        $splitIds: [ID!]
      ) {
        dataset: node(id: $datasetId) {
          ...PlaygroundDatasetExamplesTableFragment
            @arguments(splitIds: $splitIds)
          ... on Dataset {
            latestVersions: versions(
              first: 1
              sort: { col: createdAt, dir: desc }
            ) {
              edges {
                version: node {
                  id
                }
              }
            }
          }
        }
      }
    `,
    { datasetId, splitIds: splitIds ?? null }
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
        splitIds: { type: "[ID!]" }
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 20 }
      ) {
        examples(
          datasetVersionId: $datasetVersionId
          splitIds: $splitIds
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

  const exampleIds = useMemo(() => {
    return tableData.map((row) => row.id);
  }, [tableData]);

  // We assume that the experiments were run on the latest version of the dataset.
  // This is subject to a race condition where a new dataset version is created after the playground experiments were run.
  // We ignore this edge case for now.
  const datasetVersionId = useMemo(() => {
    return dataset.latestVersions?.edges[0].version.id ?? "";
  }, [dataset.latestVersions?.edges]);

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
            <AlphabeticIndexIcon index={index} size="XS" />
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
              onViewExperimentRunDetailsPress={() => {
                setSelectedExampleIndex(row.index);
              }}
              onViewTracePress={(traceId, projectId, evaluatorName) => {
                setSelectedTraceInfo({ traceId, projectId, evaluatorName });
              }}
            />
          );
        },
        size: 500,
      };
    });
  }, [
    hasSomeRunIds,
    instances,
    templateFormat,
    allInstanceMessages,
    setSelectedExampleIndex,
  ]);

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
            <PaddedCell>
              <LargeTextWrap height={200}>
                <JSONText
                  json={row.original.input}
                  disableTitle
                  space={2}
                  collapseSingleKey={false}
                />
              </LargeTextWrap>
            </PaddedCell>
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
            <PaddedCell>
              <JSONCell {...props} collapseSingleKey={true} height={200} />
            </PaddedCell>
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

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 310, // estimated row height
    overscan: 5,
  });

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
  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().columnSizingInfo,
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
          <MemoizedTableBody table={table} virtualizer={virtualizer} />
        ) : (
          <TableBody table={table} virtualizer={virtualizer} />
        )}
      </table>
      <ModalOverlay
        isOpen={selectedExampleIndex !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedExampleIndex(null);
          }
        }}
      >
        <Modal variant="slideover" size="fullscreen">
          {selectedExampleIndex !== null &&
            exampleIds[selectedExampleIndex] &&
            baseExperimentId != null &&
            isStringArray(compareExperimentIds) && (
              <ExperimentCompareDetailsDialog
                datasetId={datasetId}
                datasetVersionId={datasetVersionId}
                selectedExampleIndex={selectedExampleIndex}
                selectedExampleId={exampleIds[selectedExampleIndex]}
                baseExperimentId={baseExperimentId}
                compareExperimentIds={compareExperimentIds}
                exampleIds={exampleIds}
                onExampleChange={(exampleIndex) => {
                  if (
                    exampleIndex === exampleIds.length - 1 &&
                    !isLoadingNext &&
                    hasNext
                  ) {
                    loadNext(PAGE_SIZE);
                  }
                  if (exampleIndex >= 0 && exampleIndex < exampleIds.length) {
                    setSelectedExampleIndex(exampleIndex);
                  }
                }}
                openTraceDialog={(traceId, projectId) => {
                  setSelectedTraceInfo({ traceId, projectId });
                }}
              />
            )}
        </Modal>
      </ModalOverlay>
      <ModalOverlay
        isOpen={selectedTraceInfo !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedTraceInfo(null);
            setSearchParams(
              (prev) => {
                const newParams = new URLSearchParams(prev);
                newParams.delete(SELECTED_SPAN_NODE_ID_PARAM);
                return newParams;
              },
              { replace: true }
            );
          }
        }}
      >
        <Modal variant="slideover" size="fullscreen">
          {selectedTraceInfo && (
            <PlaygroundRunTraceDetailsDialog
              traceId={selectedTraceInfo.traceId}
              projectId={selectedTraceInfo.projectId}
              title={
                selectedTraceInfo.evaluatorName
                  ? `Evaluator Trace: ${selectedTraceInfo.evaluatorName}`
                  : "Experiment Run Trace"
              }
            />
          )}
        </Modal>
      </ModalOverlay>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
graphql`
  subscription PlaygroundDatasetExamplesTableSubscription(
    $input: ChatCompletionOverDatasetInput!
  ) {
    chatCompletionOverDataset(input: $input) {
      __typename
      ... on TextChunk {
        content
        datasetExampleId
        repetitionNumber
      }
      ... on ToolCallChunk {
        id
        datasetExampleId
        repetitionNumber
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
        repetitionNumber
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
        repetitionNumber
        message
      }
      ... on EvaluationChunk {
        datasetExampleId
        repetitionNumber
        experimentRunEvaluation {
          id
          name
          label
          score
          annotatorKind
          explanation
          metadata
          startTime
          trace {
            traceId
            projectId
          }
        }
      }
    }
  }
`;
