import { css } from "@emotion/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { KeyboardEvent } from "react";

import {
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
  Token,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { LoadMoreButton } from "@phoenix/components/core/LoadMoreButton";
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";
import { AnnotationPreviewPopoverButton } from "@phoenix/components/evaluators/EvaluatorOutputPreview";
import {
  selectableTableCSS,
  TABLE_DATA_CELL_CLASS,
} from "@phoenix/components/table/styles";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import {
  isRecordedRunEntryRunnable,
  type RecordedRunEntry,
  type RecordedRunRow,
  shortenRecordId,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import {
  formatElapsedShort,
  formatEvaluationRecordKind,
  type ProjectEvaluatorRecordKind,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { assertUnreachable } from "@phoenix/typeUtils";

/** The one column that takes whatever width the fixed columns leave. */
const NAME_COLUMN_ID = "name";

/** What the per-kind size column adds up, in its header. */
const SIZE_HEADER_BY_RECORD_KIND: Record<
  Exclude<ProjectEvaluatorRecordKind, "span">,
  string
> = {
  trace: "Spans · tokens",
  session: "Traces · tokens",
};

/** Whether the key chord that tests the focused row was pressed. */
export function isRunRowKeyChord(event: KeyboardEvent): boolean {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

/**
 * The records the evaluator would run on, one per row, dense enough to scan.
 * Clicking a row focuses it in the inspector below. The test control sits at
 * the end of the row with the result it produces, so the two read as one
 * thing; the header's button tests every row that can run. Arrow keys move
 * the focused row and ⌘/Ctrl+Enter tests it. Plain Enter does nothing: it
 * conventionally selects, and the row is already selected.
 */
export function ProjectEvaluatorRecordTable({
  entries,
  recordKind,
  focusedRowKey,
  onFocusRow,
  isRunnable,
  runBlocker,
  onRunRow,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  /** The rows with their mapping and run state already derived. */
  entries: readonly RecordedRunEntry[];
  recordKind: ProjectEvaluatorRecordKind;
  focusedRowKey: string | null;
  onFocusRow: (rowKey: string) => void;
  isRunnable: boolean;
  /** Why no row can run right now, shown on each disabled test button. */
  runBlocker: string | null;
  onRunRow: (row: RecordedRunRow) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  // TanStack's table instance hands back functions the compiler cannot
  // memoize without leaving stale rows; the table is cheap to re-derive.
  "use no memo";
  const tableData = entries as RecordedRunEntry[];
  const recordNoun = formatEvaluationRecordKind(recordKind);
  const columns: ColumnDef<RecordedRunEntry>[] = [
    ...(recordKind === "span"
      ? [
          {
            id: "kind",
            header: "Kind",
            size: 84,
            cell: ({ row: { original } }) =>
              original.row.spanKind ? (
                <SpanKindToken spanKind={original.row.spanKind} size="S" />
              ) : null,
          } satisfies ColumnDef<RecordedRunEntry>,
        ]
      : []),
    {
      id: NAME_COLUMN_ID,
      header: recordNoun,
      cell: ({ row: { original } }) => (
        <div className="record-table__name">
          <Flex direction="row" alignItems="center" gap="size-100">
            <span className="record-table__title" title={original.row.name}>
              {original.row.name}
            </span>
            {original.row.isSample ? <Token size="S">Sample</Token> : null}
          </Flex>
          {original.row.snippet ? (
            <span
              className="record-table__snippet"
              title={original.row.snippet}
            >
              {original.row.snippet}
            </span>
          ) : null}
        </div>
      ),
    },
    // A session is named by its id, so an id column would repeat the name.
    ...(recordKind !== "session"
      ? [
          {
            id: "recordId",
            header: `${recordNoun} ID`,
            size: 112,
            cell: ({ row: { original } }) => (
              <span className="record-table__id" title={original.row.recordId}>
                {shortenRecordId(original.row.recordId)}
              </span>
            ),
          } satisfies ColumnDef<RecordedRunEntry>,
        ]
      : []),
    {
      id: "age",
      header: "Age",
      size: 56,
      cell: ({ row: { original } }) =>
        original.row.startTime ? (
          <Text size="XS" color="text-500">
            {formatElapsedShort(original.row.startTime)}
          </Text>
        ) : null,
    },
    ...(recordKind !== "span"
      ? [
          {
            id: "metric",
            header: SIZE_HEADER_BY_RECORD_KIND[recordKind],
            size: 180,
            cell: ({ row: { original } }) =>
              original.row.metric ? (
                <Text size="S" color="text-500">
                  {original.row.metric}
                </Text>
              ) : null,
          } satisfies ColumnDef<RecordedRunEntry>,
        ]
      : []),
    {
      id: "result",
      header: "Result",
      size: 300,
      cell: ({ row: { original } }) => (
        <RecordedRunResultCell
          entry={original}
          recordKind={recordKind}
          isRunnable={isRunnable}
          runBlocker={runBlocker}
          onRun={() => onRunRow(original.row)}
        />
      ),
    },
  ];
  // eslint-disable-next-line react/incompatible-library
  const table = useReactTable<RecordedRunEntry>({
    columns,
    data: tableData,
    getRowId: (entry) => entry.row.key,
    getCoreRowModel: getCoreRowModel(),
  });
  const tableRows = table.getRowModel().rows;
  const focusRowAt = (
    event: KeyboardEvent<HTMLTableRowElement>,
    index: number
  ) => {
    const target = tableRows[index];
    if (!target) {
      return;
    }
    event.preventDefault();
    onFocusRow(target.original.row.key);
    const tbody = event.currentTarget.parentElement;
    const nextRow = tbody?.children.item(index);
    if (nextRow instanceof HTMLElement) {
      nextRow.focus();
    }
  };
  return (
    <div css={tableScrollCSS}>
      <table
        css={recordTableCSS}
        aria-label={`Recent matching ${recordKind}s`}
        data-testid="project-evaluator-record-table"
      >
        {/* Fixed layout reads the column widths from here: every column but
            the name takes its size, and the name takes what is left. */}
        <colgroup>
          {table.getAllLeafColumns().map((column) => (
            <col
              key={column.id}
              style={
                column.id === NAME_COLUMN_ID
                  ? undefined
                  : { width: column.columnDef.size ?? 150 }
              }
            />
          ))}
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {tableRows.map((tableRow, index) => {
            const { row } = tableRow.original;
            const isFocused = row.key === focusedRowKey;
            const canRun =
              isRunnable && isRecordedRunEntryRunnable(tableRow.original);
            return (
              <tr
                key={tableRow.id}
                data-selected={isFocused}
                tabIndex={isFocused ? 0 : -1}
                onClick={() => onFocusRow(row.key)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) {
                    // A control inside the row owns its own keys.
                    return;
                  }
                  if (event.key === "ArrowDown") {
                    focusRowAt(event, index + 1);
                  } else if (event.key === "ArrowUp") {
                    focusRowAt(event, index - 1);
                  } else if (isRunRowKeyChord(event) && canRun) {
                    event.preventDefault();
                    onRunRow(row);
                  }
                }}
              >
                {tableRow.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={TABLE_DATA_CELL_CLASS}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {hasMore ? (
            // Spans exactly the table's columns: a larger span would add
            // phantom columns that the fixed layout hands width to.
            <tr>
              <td colSpan={columns.length} className="record-table__load-more">
                <LoadMoreButton
                  onLoadMore={onLoadMore}
                  isLoadingNext={isLoadingMore}
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Why this row cannot be tested right now, or null when it can. The record's
 * own reasons come first: a context the server could not build, then a
 * mapping with nothing to read, then whatever stops every row.
 */
export function getRowTestBlocker({
  entry,
  recordKind,
  isRunnable,
  runBlocker,
}: {
  entry: RecordedRunEntry;
  recordKind: ProjectEvaluatorRecordKind;
  isRunnable: boolean;
  runBlocker: string | null;
}): string | null {
  const { row, resultState } = entry;
  if (resultState.kind === "unavailable") {
    return row.unavailableReason ?? "No evaluation context";
  }
  if (resultState.kind === "missing") {
    return `Map ${resultState.count === 1 ? "the missing input" : "the missing inputs"} before testing this ${recordKind}`;
  }
  if (!isRunnable) {
    return runBlocker ?? "Fix the evaluator's annotation configuration to test";
  }
  return null;
}

/**
 * The row's test control: a play icon before the first run, a refresh icon
 * once a result exists, and a spinner while a test is in flight.
 */
function TestRowButton({
  entry,
  recordKind,
  isRunnable,
  runBlocker,
  onRun,
}: {
  entry: RecordedRunEntry;
  recordKind: ProjectEvaluatorRecordKind;
  isRunnable: boolean;
  runBlocker: string | null;
  onRun: () => void;
}) {
  const { row, run, resultState } = entry;
  if (resultState.kind === "running") {
    return <ProgressCircle isIndeterminate size="S" aria-label="Testing" />;
  }
  const blocker = getRowTestBlocker({
    entry,
    recordKind,
    isRunnable,
    runBlocker,
  });
  const isRetest = run != null;
  const button = (
    <IconButton
      size="S"
      aria-label={
        // Recent records commonly share a name; suffix the record id so
        // each row's button has a distinct accessible name.
        row.isSample
          ? `Test evaluator on ${row.name}`
          : `Test evaluator on ${row.name}, ${recordKind} ${shortenRecordId(
              row.recordId
            )}`
      }
      isDisabled={blocker != null}
      onPress={onRun}
    >
      <Icon svg={isRetest ? <Icons.Refresh /> : <Icons.Play />} />
    </IconButton>
  );
  return (
    <TooltipTrigger delay={500}>
      {/* A disabled button takes no pointer events, so the reason it is
          disabled hangs off a wrapper that does. */}
      {blocker != null ? <TriggerWrap>{button}</TriggerWrap> : button}
      <Tooltip placement="start">
        <TooltipArrow />
        {blocker != null
          ? `${blocker}.`
          : `${isRetest ? "Re-test" : "Test"} the evaluator on this ${recordKind}. Results are previews and are not saved.`}
      </Tooltip>
    </TooltipTrigger>
  );
}

/**
 * The Result column: what the last test said, in plain words, with the
 * control that produces it at the end of the row. The annotation chip is the
 * only coloured thing here; the states around it are text, so a row that
 * cannot run yet does not shout over one that failed.
 */
function RecordedRunResultCell({
  entry,
  recordKind,
  isRunnable,
  runBlocker,
  onRun,
}: {
  entry: RecordedRunEntry;
  recordKind: ProjectEvaluatorRecordKind;
  isRunnable: boolean;
  runBlocker: string | null;
  onRun: () => void;
}) {
  return (
    <div css={resultCellCSS}>
      <div className="result-cell__value">
        <RecordedRunResultValue entry={entry} />
      </div>
      <TestRowButton
        entry={entry}
        recordKind={recordKind}
        isRunnable={isRunnable}
        runBlocker={runBlocker}
        onRun={onRun}
      />
    </div>
  );
}

function RecordedRunResultValue({ entry }: { entry: RecordedRunEntry }) {
  const { resultState: state } = entry;
  switch (state.kind) {
    case "annotated":
      return (
        <div className="result-cell__annotation" data-stale={state.isStale}>
          <span className="result-cell__chip">
            <AnnotationPreviewPopoverButton
              annotation={state.annotation}
              compact
            />
          </span>
          {state.isStale ? <StaleNote /> : null}
        </div>
      );
    case "failed":
      return (
        <Flex direction="row" alignItems="center" gap="size-75">
          <Text size="S" color="danger">
            Error
          </Text>
          {state.isStale ? <StaleNote /> : null}
        </Flex>
      );
    case "missing":
      return (
        <Text size="S" color="text-700">
          {state.count === 1
            ? "1 input missing"
            : `${state.count} inputs missing`}
        </Text>
      );
    case "unavailable":
      return (
        <Text size="S" color="text-700">
          No context
        </Text>
      );
    case "running":
      return (
        <Text size="S" color="text-500">
          Testing…
        </Text>
      );
    case "idle":
      return (
        <Text size="S" color="text-300">
          Not tested
        </Text>
      );
    default:
      return assertUnreachable(state);
  }
}

function StaleNote() {
  return (
    <TooltipTrigger delay={300}>
      <TriggerWrap>
        <Text size="XS" color="text-500">
          stale
        </Text>
      </TriggerWrap>
      <Tooltip placement="top">
        <TooltipArrow />
        The evaluator changed after this result. Re-test to refresh it.
      </Tooltip>
    </TooltipTrigger>
  );
}

/**
 * The value takes what the button leaves. The compact chip hugs its content
 * up to its container's width, so it sits in a wrapper that shrinks and clips
 * while the stale note and the button never give way.
 */
const resultCellCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  .result-cell__value {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    align-items: center;
  }
  > :not(.result-cell__value) {
    flex: none;
  }
  .result-cell__annotation {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-75);
    min-width: 0;
    max-width: 100%;
    > :not(.result-cell__chip) {
      flex: none;
    }
    &[data-stale="true"] .result-cell__chip {
      opacity: 0.5;
    }
  }
  .result-cell__chip {
    display: flex;
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
  }
`;

const tableScrollCSS = css`
  height: 100%;
  overflow: auto;
  // No bounce at the ends, and no scroll chaining out to the dialog.
  overscroll-behavior: none;
`;

const recordTableCSS = css(
  selectableTableCSS,
  css`
    table-layout: fixed;
    tbody:not(.is-empty) tr {
      &:focus-visible {
        outline: 2px solid var(--global-color-info);
        outline-offset: -2px;
      }
      // Rows stay one even height so the list scans as a grid.
      td.${TABLE_DATA_CELL_CLASS} {
        vertical-align: middle;
        overflow: hidden;
      }
    }
    .record-table__name {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .record-table__title {
      color: var(--global-text-color-900);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .record-table__snippet {
      color: var(--global-text-color-500);
      font-size: var(--global-font-size-xs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .record-table__load-more {
      text-align: center;
      > * {
        display: inline-flex;
      }
    }
    .record-table__id {
      display: block;
      font-family: var(--global-font-family-code, monospace);
      font-size: var(--global-font-size-xs);
      color: var(--global-text-color-700);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    // Cells hold to one line each; what does not fit is cut, not wrapped.
    td.${TABLE_DATA_CELL_CLASS} {
      white-space: nowrap;
    }
  `
);
