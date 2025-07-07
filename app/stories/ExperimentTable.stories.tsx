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
  input: {
    question: string;
  };
  output: {
    query: string;
    results: Array<Record<string, unknown>>;
    error: string | null;
  };
  startTime: string;
  endTime: string;
  tokenCount: number;
  cost: number;
  latency_ms: number;
  trace_id: string;
  annotations: Array<{
    id: string;
    name: string;
    score: number;
    label: string | null;
    annotatorKind: "CODE" | "LLM" | "HUMAN";
    explanation: string | null;
  }>;
};

// Mock data - SQL Generation Experiment Results
const mockExperiments: MockExperiment[] = [
  {
    id: "exp-1",
    name: "GPT-4 SQL Generator",
    sequenceNumber: 1,
    description: "Text-to-SQL generation using GPT-4",
    input: { question: "Which Brad Pitt movie received the highest rating?" },
    output: {
      query:
        "SELECT title, MAX(vote_average) AS highest_rating\nFROM movies\nWHERE credits LIKE '%Brad Pitt%'\nGROUP BY title\nORDER BY highest_rating DESC\nLIMIT 1;",
      results: [{ title: "Voom Portraits", highest_rating: 10.0 }],
      error: null,
    },
    startTime: "2025-07-02T21:00:25.751511+00:00",
    endTime: "2025-07-02T21:00:27.297066+00:00",
    tokenCount: 342,
    cost: 0.0205,
    latency_ms: 1545.555,
    trace_id: "d2e0886a4067705b5e59accfbd503e07",
    annotations: [
      {
        id: "ann-1",
        name: "has_results",
        score: 1.0,
        label: null,
        annotatorKind: "CODE",
        explanation: null,
      },
      {
        id: "ann-2",
        name: "qa_correctness",
        score: 1.0,
        label: "correct",
        annotatorKind: "LLM",
        explanation:
          "The SQL query is designed to find the Brad Pitt movie with the highest rating by selecting the maximum vote_average for movies with Brad Pitt in their credits.",
      },
    ],
  },
  {
    id: "exp-2",
    name: "Claude-3 SQL Generator",
    sequenceNumber: 2,
    description: "Text-to-SQL generation using Claude-3 Sonnet",
    input: { question: "What is the top grossing Marvel movie?" },
    output: {
      query:
        "SELECT title, revenue FROM movies WHERE production_companies LIKE '%Marvel%' ORDER BY revenue DESC LIMIT 1;",
      results: [{ title: "Avengers: Endgame", revenue: 2799439100.0 }],
      error: null,
    },
    startTime: "2025-07-02T21:00:25.753230+00:00",
    endTime: "2025-07-02T21:00:26.823432+00:00",
    tokenCount: 198,
    cost: 0.0089,
    latency_ms: 1070.202,
    trace_id: "743be2151d59064c8f42318073d42212",
    annotations: [
      {
        id: "ann-3",
        name: "has_results",
        score: 1.0,
        label: null,
        annotatorKind: "CODE",
        explanation: null,
      },
      {
        id: "ann-4",
        name: "qa_correctness",
        score: 1.0,
        label: "correct",
        annotatorKind: "LLM",
        explanation:
          "The SQL query retrieves the top-grossing movie produced by Marvel from the movies database, correctly filtering and ordering by revenue.",
      },
    ],
  },
  {
    id: "exp-3",
    name: "GPT-3.5 Turbo SQL",
    sequenceNumber: 3,
    description: "Cost-effective SQL generation with GPT-3.5 Turbo",
    input: {
      question: "What foreign-language fantasy movie was the most popular?",
    },
    output: {
      query:
        "SELECT title, popularity\nFROM movies\nWHERE genres LIKE '%Fantasy%' AND original_language != 'en'\nORDER BY popularity DESC\nLIMIT 1;",
      results: [
        { title: "The Nights Belong to Monsters", popularity: 742.199 },
      ],
      error: null,
    },
    startTime: "2025-07-02T21:00:25.754573+00:00",
    endTime: "2025-07-02T21:00:27.818045+00:00",
    tokenCount: 156,
    cost: 0.0047,
    latency_ms: 2063.472,
    trace_id: "1e4ae32ad1e1995b0c891182ddf9ef3c",
    annotations: [
      {
        id: "ann-5",
        name: "has_results",
        score: 1.0,
        label: null,
        annotatorKind: "CODE",
        explanation: null,
      },
      {
        id: "ann-6",
        name: "qa_correctness",
        score: 1.0,
        label: "correct",
        annotatorKind: "LLM",
        explanation:
          "The SQL query correctly retrieves the most popular foreign-language fantasy movie by filtering for Fantasy genre and excluding English language movies.",
      },
    ],
  },
  {
    id: "exp-4",
    name: "Gemini Pro SQL",
    sequenceNumber: 4,
    description: "Google Gemini Pro for SQL generation tasks",
    input: { question: "What anime topped the box office in the 2010s?" },
    output: {
      query:
        "SELECT title, MAX(revenue) AS max_revenue\nFROM movies\nWHERE genres LIKE '%Animation%'\nAND release_date BETWEEN '2010-01-01' AND '2019-12-31'\nGROUP BY title\nORDER BY max_revenue DESC\nLIMIT 1;",
      results: [{ title: "Frozen II", max_revenue: 1450026933.0 }],
      error: null,
    },
    startTime: "2025-07-02T21:00:27.304111+00:00",
    endTime: "2025-07-02T21:00:28.197236+00:00",
    tokenCount: 287,
    cost: 0.0172,
    latency_ms: 893.125,
    trace_id: "b3efd598c7e0feff3e3b2a09197da370",
    annotations: [
      {
        id: "ann-7",
        name: "has_results",
        score: 1.0,
        label: null,
        annotatorKind: "CODE",
        explanation: null,
      },
      {
        id: "ann-8",
        name: "qa_correctness",
        score: 0.0,
        label: "invalid",
        annotatorKind: "LLM",
        explanation:
          "The question asks for anime specifically, but the query retrieves animated movies in general. Anime refers specifically to Japanese animation.",
      },
    ],
  },
  {
    id: "exp-5",
    name: "Mistral 7B SQL",
    sequenceNumber: 5,
    description: "Open-source Mistral 7B model for SQL generation",
    input: { question: "Recommend a romcom that stars Paul Rudd." },
    output: {
      query:
        "SELECT * FROM movies \nWHERE genres LIKE '%Romance%' \nAND genres LIKE '%Comedy%' \nAND credits LIKE '%Paul Rudd%' \nORDER BY popularity DESC \nLIMIT 1;",
      results: [
        {
          title: "Clueless",
          genres: "Comedy-Romance",
          popularity: 28.372,
          vote_average: 7.3,
          overview:
            "Shallow rich and socially successful Cher is at the top of her Beverly Hills high school's pecking scale...",
        },
      ],
      error: null,
    },
    startTime: "2025-07-02T21:00:27.607845+00:00",
    endTime: "2025-07-02T21:00:28.968198+00:00",
    tokenCount: 445,
    cost: 0.0133,
    latency_ms: 1360.353,
    trace_id: "b633719a8387ebed2ddce9e195ee3e74",
    annotations: [
      {
        id: "ann-9",
        name: "has_results",
        score: 1.0,
        label: null,
        annotatorKind: "CODE",
        explanation: null,
      },
      {
        id: "ann-10",
        name: "qa_correctness",
        score: 1.0,
        label: "correct",
        annotatorKind: "LLM",
        explanation:
          "The SQL query correctly filters for movies in Romance and Comedy genres that include Paul Rudd in the credits.",
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

        const latencyMs = currentExperiment.latency_ms;

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
A realistic experiment table showing SQL generation experiment results:
- **CellTop Components**: Structured cell headers with controls and metadata
- **TokenCount Component**: Display token usage with proper formatting  
- **TokenCosts Component**: Show experiment costs with price formatting
- **Column Resizing**: Drag column borders to adjust widths
- **Real Experiment Data**: Uses actual text-to-SQL generation experiment results
- **Annotation Display**: Show evaluation scores (has_results, qa_correctness) with explanations
- **SQL Query Rendering**: Display input questions and generated SQL queries with results

This table demonstrates realistic experiment tracking for LLM-based SQL generation tasks, 
including performance metrics, cost tracking, and quality annotations.
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
 * Realistic SQL generation experiment table with actual experiment data.
 * Shows text-to-SQL experiments using different LLM models with performance metrics,
 * costs, annotations, and generated SQL queries with results.
 */
export const Default: Story = {
  args: {
    displayFullText: false,
  },
};
