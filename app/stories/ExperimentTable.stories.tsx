import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Flex, Icon, IconButton, Icons, Text, View } from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation";
import { JSONText } from "@phoenix/components/code/JSONText";
import { SequenceNumberToken } from "@phoenix/components/experiment/SequenceNumberToken";
import { CellTop } from "@phoenix/components/table";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import {
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components/tooltip";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { makeSafeColumnId } from "@phoenix/utils/tableUtils";

// Mock data types
type MockExperiment = {
  id: string;
  name: string;
  sequenceNumber: number;
  description: string;
  input: unknown;
  output: unknown;
  startTime: string;
  endTime: string;
  tokenCount: number;
  cost: number;
  annotations: Array<{
    id: string;
    name: string;
    score: number;
    label: string;
    annotatorKind: "HUMAN" | "LLM";
  }>;
};

// Mock data
const mockExperiments: MockExperiment[] = [
  {
    id: "exp-1",
    name: "GPT-4 Baseline",
    sequenceNumber: 1,
    description: "Initial baseline experiment using GPT-4",
    input: { question: "What is renewable energy?" },
    output: {
      answer:
        "Renewable energy comes from natural sources that replenish themselves.",
    },
    startTime: "2024-01-15T10:30:00Z",
    endTime: "2024-01-15T10:30:02Z",
    tokenCount: 245,
    cost: 0.0147,
    annotations: [
      {
        id: "ann-1",
        name: "relevance",
        score: 0.89,
        label: "relevant",
        annotatorKind: "LLM",
      },
      {
        id: "ann-2",
        name: "accuracy",
        score: 0.92,
        label: "accurate",
        annotatorKind: "HUMAN",
      },
    ],
  },
  {
    id: "exp-2",
    name: "GPT-4 Optimized",
    sequenceNumber: 2,
    description: "Optimized prompt engineering experiment",
    input: { question: "How does machine learning work?" },
    output: {
      answer:
        "Machine learning uses algorithms to learn patterns from data automatically.",
    },
    startTime: "2024-01-15T11:00:00Z",
    endTime: "2024-01-15T11:00:03Z",
    tokenCount: 312,
    cost: 0.0187,
    annotations: [
      {
        id: "ann-3",
        name: "relevance",
        score: 0.95,
        label: "highly relevant",
        annotatorKind: "LLM",
      },
      {
        id: "ann-4",
        name: "accuracy",
        score: 0.94,
        label: "accurate",
        annotatorKind: "HUMAN",
      },
    ],
  },
  {
    id: "exp-3",
    name: "Claude-3 Sonnet",
    sequenceNumber: 3,
    description: "Testing Claude-3 Sonnet model",
    input: { question: "What are the benefits of AI?" },
    output: {
      answer:
        "AI can automate tasks, improve decision-making, and enhance productivity.",
    },
    startTime: "2024-01-15T12:00:00Z",
    endTime: "2024-01-15T12:00:02Z",
    tokenCount: 267,
    cost: 0.053,
    annotations: [
      {
        id: "ann-5",
        name: "relevance",
        score: 0.93,
        label: "highly relevant",
        annotatorKind: "LLM",
      },
      {
        id: "ann-6",
        name: "accuracy",
        score: 0.96,
        label: "accurate",
        annotatorKind: "HUMAN",
      },
    ],
  },
  {
    id: "exp-4",
    name: "GPT-3.5 Turbo",
    sequenceNumber: 4,
    description: "Cost-effective experiment with GPT-3.5 Turbo",
    input: { question: "Explain photosynthesis in simple terms" },
    output: {
      answer:
        "Photosynthesis is how plants make food from sunlight, water, and carbon dioxide.",
    },
    startTime: "2024-01-15T13:15:00Z",
    endTime: "2024-01-15T13:15:01Z",
    tokenCount: 189,
    cost: 0.0089,
    annotations: [
      {
        id: "ann-7",
        name: "relevance",
        score: 0.91,
        label: "relevant",
        annotatorKind: "LLM",
      },
      {
        id: "ann-8",
        name: "accuracy",
        score: 0.88,
        label: "accurate",
        annotatorKind: "HUMAN",
      },
      {
        id: "ann-9",
        name: "clarity",
        score: 0.95,
        label: "clear",
        annotatorKind: "LLM",
      },
    ],
  },
  {
    id: "exp-5",
    name: "Claude-3 Haiku",
    sequenceNumber: 5,
    description: "Fast response experiment with Claude-3 Haiku",
    input: { question: "What is the capital of France?" },
    output: {
      answer: "The capital of France is Paris.",
    },
    startTime: "2024-01-15T14:20:00Z",
    endTime: "2024-01-15T14:20:01Z",
    tokenCount: 156,
    cost: 0.0031,
    annotations: [
      {
        id: "ann-10",
        name: "relevance",
        score: 1.0,
        label: "highly relevant",
        annotatorKind: "LLM",
      },
      {
        id: "ann-11",
        name: "accuracy",
        score: 1.0,
        label: "accurate",
        annotatorKind: "HUMAN",
      },
    ],
  },
  {
    id: "exp-6",
    name: "Gemini Pro",
    sequenceNumber: 6,
    description: "Experiment with Google's Gemini Pro model",
    input: { question: "How do neural networks learn?" },
    output: {
      answer:
        "Neural networks learn by adjusting connection weights through backpropagation based on training data.",
    },
    startTime: "2024-01-15T15:30:00Z",
    endTime: "2024-01-15T15:30:03Z",
    tokenCount: 298,
    cost: 0.0156,
    annotations: [
      {
        id: "ann-12",
        name: "relevance",
        score: 0.94,
        label: "highly relevant",
        annotatorKind: "LLM",
      },
      {
        id: "ann-13",
        name: "accuracy",
        score: 0.93,
        label: "accurate",
        annotatorKind: "HUMAN",
      },
      {
        id: "ann-14",
        name: "technical_depth",
        score: 0.87,
        label: "good depth",
        annotatorKind: "LLM",
      },
    ],
  },
  {
    id: "exp-7",
    name: "GPT-4 Turbo",
    sequenceNumber: 7,
    description: "Latest GPT-4 Turbo model testing",
    input: { question: "Describe the process of DNA replication" },
    output: {
      answer:
        "DNA replication is a semi-conservative process where the double helix unwinds and each strand serves as a template for a new complementary strand.",
    },
    startTime: "2024-01-15T16:45:00Z",
    endTime: "2024-01-15T16:45:04Z",
    tokenCount: 387,
    cost: 0.0231,
    annotations: [
      {
        id: "ann-15",
        name: "relevance",
        score: 0.98,
        label: "highly relevant",
        annotatorKind: "LLM",
      },
      {
        id: "ann-16",
        name: "accuracy",
        score: 0.97,
        label: "accurate",
        annotatorKind: "HUMAN",
      },
      {
        id: "ann-17",
        name: "technical_depth",
        score: 0.92,
        label: "excellent depth",
        annotatorKind: "LLM",
      },
    ],
  },
  {
    id: "exp-8",
    name: "Mistral 7B",
    sequenceNumber: 8,
    description: "Open-source Mistral 7B model evaluation",
    input: { question: "What are the main types of clouds?" },
    output: {
      answer:
        "The main types of clouds are cumulus (puffy), stratus (layered), and cirrus (wispy high-altitude clouds).",
    },
    startTime: "2024-01-15T17:10:00Z",
    endTime: "2024-01-15T17:10:02Z",
    tokenCount: 201,
    cost: 0.0067,
    annotations: [
      {
        id: "ann-18",
        name: "relevance",
        score: 0.86,
        label: "relevant",
        annotatorKind: "LLM",
      },
      {
        id: "ann-19",
        name: "accuracy",
        score: 0.89,
        label: "accurate",
        annotatorKind: "HUMAN",
      },
    ],
  },
];

function SimpleExperimentTable({
  experiments = mockExperiments,
  displayFullText = false,
}: {
  experiments?: MockExperiment[];
  displayFullText?: boolean;
}) {
  const [columnSizing, setColumnSizing] = useState({});

  const baseColumns: ColumnDef<MockExperiment>[] = useMemo(
    () => [
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
                      onPress={() => {
                        // Mock example details dialog
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
                  size="S"
                  color="text-500"
                >{`example ${row.original.id}`}</Text>
              </CellTop>

              <PaddedCell>
                <LargeTextWrap>
                  <JSONText
                    json={row.original.input}
                    disableTitle
                    space={displayFullText ? 2 : 0}
                  />
                </LargeTextWrap>
              </PaddedCell>
            </>
          );
        },
      },
      {
        header: "reference output",
        accessorKey: "output",
        cell: ({ getValue }: { getValue: () => unknown }) => (
          <>
            <CellTop>
              <Text size="S" color="text-500">
                reference
              </Text>
            </CellTop>
            <PaddedCell>
              <LargeTextWrap>
                <JSONText
                  json={getValue()}
                  disableTitle
                  space={displayFullText ? 2 : 0}
                />
              </LargeTextWrap>
            </PaddedCell>
          </>
        ),
      },
    ],
    [displayFullText]
  );

  const experimentColumns: ColumnDef<MockExperiment>[] = useMemo(() => {
    return mockExperiments.slice(0, 3).map((experiment) => ({
      header: () => {
        const name = experiment.name;
        const sequenceNumber = experiment.sequenceNumber;
        return (
          <Flex
            direction="row"
            gap="size-100"
            wrap
            alignItems="center"
            justifyContent="space-between"
          >
            <Flex direction="row" gap="size-100" wrap alignItems="center">
              <SequenceNumberToken sequenceNumber={sequenceNumber} />
              <Text>{name}</Text>
            </Flex>
            <IconButton
              size="S"
              onPress={() => {
                // Mock action menu - no network required
              }}
            >
              <Icon svg={<Icons.MoreHorizontalOutline />} />
            </IconButton>
          </Flex>
        );
      },
      accessorKey: experiment.id,
      minSize: 500,
      cell: ({ row: _row }) => {
        const currentExperiment = mockExperiments.find(
          (exp) => exp.id === experiment.id
        );
        if (!currentExperiment) {
          return (
            <Flex direction="row" gap="size-50">
              <Icon svg={<Icons.MinusCircleOutline />} color="grey-800" />
              <Text color="text-700">not run</Text>
            </Flex>
          );
        }

        const latencyMs =
          new Date(currentExperiment.endTime).getTime() -
          new Date(currentExperiment.startTime).getTime();

        const runControls = (
          <>
            <TooltipTrigger>
              <IconButton
                className="expand-button"
                size="S"
                aria-label="View example run details"
                onPress={() => {
                  // Mock dialog
                }}
              >
                <Icon svg={<Icons.ExpandOutline />} />
              </IconButton>
              <Tooltip>
                <TooltipArrow />
                view experiment run
              </Tooltip>
            </TooltipTrigger>
            <TooltipTrigger>
              <IconButton
                className="trace-button"
                size="S"
                aria-label="View run trace"
                onPress={() => {
                  // Mock trace dialog
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

        return (
          <>
            <CellTop extra={runControls}>
              <Flex direction="row" gap="size-100">
                <LatencyText size="S" latencyMs={latencyMs} />
                <TokenCount size="S">{currentExperiment.tokenCount}</TokenCount>
                <TokenCosts size="S">{currentExperiment.cost}</TokenCosts>
              </Flex>
            </CellTop>
            <PaddedCell>
              <Flex
                direction="column"
                gap="size-100"
                height="100%"
                justifyContent="space-between"
              >
                <LargeTextWrap>
                  <JSONText
                    json={currentExperiment.output}
                    disableTitle
                    space={displayFullText ? 2 : 0}
                  />
                </LargeTextWrap>
                <ul
                  css={css`
                    display: flex;
                    flex-direction: row;
                    gap: var(--ac-global-dimension-static-size-100);
                    align-items: center;
                    flex-wrap: wrap;
                  `}
                >
                  {currentExperiment.annotations.map((annotation) => (
                    <li key={annotation.id}>
                      <AnnotationLabel annotation={annotation} />
                    </li>
                  ))}
                </ul>
              </Flex>
            </PaddedCell>
          </>
        );
      },
    }));
  }, [displayFullText]);

  const columns = useMemo(() => {
    return [...baseColumns, ...experimentColumns];
  }, [baseColumns, experimentColumns]);

  const table = useReactTable<MockExperiment>({
    columns,
    data: experiments,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
  });

  const columnSizeVars = useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      colSizes[`--header-${makeSafeColumnId(header.id)}-size`] =
        header.getSize();
      colSizes[`--col-${makeSafeColumnId(header.column.id)}-size`] =
        header.column.getSize();
    }
    return colSizes;
  }, [table]);

  return (
    <View
      backgroundColor="grey-50"
      borderColor="light"
      borderWidth="thin"
      borderRadius="medium"
      overflow="hidden"
    >
      <div
        css={css`
          overflow: auto;
          table {
            min-width: 100%;
            td {
              vertical-align: top;
            }
          }
        `}
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
                    colSpan={header.colSpan}
                    style={{
                      width: `calc(var(--header-${makeSafeColumnId(header.id)}-size) * 1px)`,
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <>
                        <div style={{ width: "100%" }}>
                          <Truncate maxWidth="100%">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </Truncate>
                        </div>
                        <div
                          {...{
                            onMouseDown: header.getResizeHandler(),
                            onTouchStart: header.getResizeHandler(),
                            className: `resizer ${header.column.getIsResizing() ? "isResizing" : ""}`,
                          }}
                        />
                      </>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      width: `calc(var(--col-${makeSafeColumnId(cell.column.id)}-size) * 1px)`,
                      maxWidth: `calc(var(--col-${makeSafeColumnId(cell.column.id)}-size) * 1px)`,
                      padding: 0,
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </View>
  );
}

// Helper Components
function LargeTextWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      css={css`
        max-height: 200px;
        overflow-y: auto;
      `}
    >
      {children}
    </div>
  );
}

function PaddedCell({ children }: { children: React.ReactNode }) {
  return (
    <View paddingX="size-200" paddingY="size-100">
      {children}
    </View>
  );
}

// Storybook Configuration
const meta: Meta<typeof SimpleExperimentTable> = {
  title: "Table/ExperimentTable",
  component: SimpleExperimentTable,
  parameters: {
    docs: {
      description: {
        component: `
A simple experiment table that demonstrates:
- **CellTop Components**: Structured cell headers with controls and labels
- **TokenCount Component**: Display token usage with proper formatting
- **Column Resizing**: Drag column borders to adjust widths
- **Experiment Metrics**: Show latency, cost, and token information
- **Annotation Display**: Show evaluation scores and labels
- **JSON Rendering**: Display input/output data with formatting options

This table provides a basic view of experiment results with essential metrics and evaluations.
        `,
      },
    },
  },
  argTypes: {
    displayFullText: {
      control: { type: "boolean" },
      description: "Whether to display full JSON formatting or compact version",
    },
  },
};

export default meta;
type Story = StoryObj<typeof SimpleExperimentTable>;

/**
 * Basic experiment table showing essential experiment information.
 * Demonstrates CellTop usage, TokenCount component, and column resizing.
 */
export const Default: Story = {
  args: {
    displayFullText: false,
  },
};

/**
 * Experiment table with full JSON text display.
 * Shows expanded formatting for better readability of input/output data.
 */
export const FullTextDisplay: Story = {
  args: {
    displayFullText: true,
  },
};
