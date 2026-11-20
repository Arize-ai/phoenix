import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { RecordedRunRow } from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import {
  NUM_RECORDS_PER_PAGE,
  useLoadMoreRecords,
} from "@phoenix/pages/project/evaluators/useLoadMoreRecords";

type LoadMoreRecords = ReturnType<typeof useLoadMoreRecords>;

function makeRows(names: string[]): RecordedRunRow[] {
  return names.map((name) => ({
    key: name,
    name,
    recordId: name,
    snippet: "",
    context: {},
    isSample: false,
  }));
}

function makeNames({ prefix, count }: { prefix: string; count: number }) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

const FIRST_PAGE_NAMES = makeNames({ prefix: "listed", count: 10 });

describe("useLoadMoreRecords", () => {
  let container: HTMLDivElement;
  let root: Root;
  let loadMoreRecords: LoadMoreRecords;

  function CaptureLoadMoreRecords({
    onCapture,
    ...props
  }: {
    filterCondition: string;
    timeWindowStartISOTimestamp: string;
    onCapture: (captured: LoadMoreRecords) => void;
  }) {
    onCapture(useLoadMoreRecords(props));
    return null;
  }

  function renderLoadMoreRecords({
    filterCondition = "span_kind == 'LLM'",
    timeWindowStartISOTimestamp = "2026-11-10T19:12:55.000Z",
  }: {
    filterCondition?: string;
    timeWindowStartISOTimestamp?: string;
  } = {}) {
    act(() =>
      root.render(
        <CaptureLoadMoreRecords
          filterCondition={filterCondition}
          timeWindowStartISOTimestamp={timeWindowStartISOTimestamp}
          onCapture={(captured) => (loadMoreRecords = captured)}
        />
      )
    );
  }

  function loadMoreAfter(loadedRows: RecordedRunRow[]) {
    const rows = loadMoreRecords.keepListedRowsFirst({
      loadedRows,
      hasNextPage: true,
    });
    act(() => loadMoreRecords.loadMore({ listedRows: rows }));
  }

  function loadMoreAfterFirstPage() {
    loadMoreAfter(makeRows(FIRST_PAGE_NAMES));
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps the listed rows at the top and adds the rest of the wider read below them", () => {
    renderLoadMoreRecords();
    loadMoreAfterFirstPage();

    const arrivedNames = makeNames({ prefix: "arrived", count: 5 });
    const olderNames = makeNames({ prefix: "older", count: 5 });
    const rows = loadMoreRecords.keepListedRowsFirst({
      loadedRows: makeRows([
        ...arrivedNames,
        ...FIRST_PAGE_NAMES,
        ...olderNames,
      ]),
      hasNextPage: true,
    });

    expect(loadMoreRecords.numRecordsToLoad).toBe(2 * NUM_RECORDS_PER_PAGE);
    expect(rows.map(({ name }) => name)).toEqual([
      ...FIRST_PAGE_NAMES,
      ...arrivedNames,
      ...olderNames,
    ]);
  });

  it("shows a listed row as the wider read returns it, and keeps one the wider read no longer reaches", () => {
    renderLoadMoreRecords();
    loadMoreAfterFirstPage();

    const refreshedRow = {
      ...makeRows(["listed-0"])[0],
      snippet: "refreshed",
    };
    const rows = loadMoreRecords.keepListedRowsFirst({
      loadedRows: [
        ...makeRows(makeNames({ prefix: "arrived", count: 19 })),
        refreshedRow,
      ],
      hasNextPage: true,
    });

    expect(
      rows.slice(0, FIRST_PAGE_NAMES.length).map(({ name }) => name)
    ).toEqual(FIRST_PAGE_NAMES);
    expect(rows[0]).toBe(refreshedRow);
    expect(rows).toHaveLength(FIRST_PAGE_NAMES.length + 19);
  });

  it("drops a listed row that a re-read of every record in scope no longer returns", () => {
    renderLoadMoreRecords();
    loadMoreAfterFirstPage();

    const remainingNames = FIRST_PAGE_NAMES.filter(
      (name) => name !== "listed-3"
    );
    const rows = loadMoreRecords.keepListedRowsFirst({
      loadedRows: makeRows([...remainingNames, "older-0"]),
      hasNextPage: false,
    });

    expect(rows.map(({ name }) => name)).toEqual([
      ...remainingNames,
      "older-0",
    ]);
  });

  it("keeps each row of a key that is listed twice", () => {
    const [firstRootSpanRow, secondRootSpanRow, otherTraceRow] = [
      { ...makeRows(["trace-1"])[0], name: "first root span" },
      { ...makeRows(["trace-1"])[0], name: "second root span" },
      ...makeRows(["trace-2"]),
    ];
    renderLoadMoreRecords();
    loadMoreAfter([firstRootSpanRow, secondRootSpanRow, otherTraceRow]);

    const rows = loadMoreRecords.keepListedRowsFirst({
      loadedRows: [
        ...makeRows(["arrived-0"]),
        firstRootSpanRow,
        secondRootSpanRow,
        otherTraceRow,
      ],
      hasNextPage: true,
    });

    expect(rows.map(({ name }) => name)).toEqual([
      "first root span",
      "second root span",
      "trace-2",
      "arrived-0",
    ]);
  });

  it.each([
    { change: "filter", next: { filterCondition: "span_kind == 'TOOL'" } },
    {
      change: "time window",
      next: { timeWindowStartISOTimestamp: "2026-11-09T20:12:55.000Z" },
    },
  ])("starts again at the first page when the $change changes", ({ next }) => {
    renderLoadMoreRecords();
    loadMoreAfterFirstPage();

    renderLoadMoreRecords(next);
    const loadedRows = makeRows(makeNames({ prefix: "other", count: 10 }));

    expect(loadMoreRecords.numRecordsToLoad).toBe(NUM_RECORDS_PER_PAGE);
    expect(
      loadMoreRecords.keepListedRowsFirst({ loadedRows, hasNextPage: true })
    ).toEqual(loadedRows);
  });

  it("keeps the loaded pages when only whitespace around the filter changes", () => {
    renderLoadMoreRecords();
    loadMoreAfterFirstPage();

    renderLoadMoreRecords({ filterCondition: "span_kind == 'LLM' " });

    expect(loadMoreRecords.numRecordsToLoad).toBe(2 * NUM_RECORDS_PER_PAGE);
  });

  it("starts at the first page on going back to an earlier filter", () => {
    renderLoadMoreRecords();
    loadMoreAfterFirstPage();

    renderLoadMoreRecords({ filterCondition: "span_kind == 'TOOL'" });
    renderLoadMoreRecords();

    expect(loadMoreRecords.numRecordsToLoad).toBe(NUM_RECORDS_PER_PAGE);
  });
});
