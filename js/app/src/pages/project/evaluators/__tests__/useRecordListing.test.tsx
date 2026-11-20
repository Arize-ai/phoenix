import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { RecordedRunRow } from "@phoenix/pages/project/evaluators/projectEvaluatorTestBenchTypes";
import {
  RECORD_PAGE_SIZE,
  useRecordListing,
} from "@phoenix/pages/project/evaluators/useRecordListing";

type RecordListing = ReturnType<typeof useRecordListing>;

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

describe("useRecordListing", () => {
  let container: HTMLDivElement;
  let root: Root;
  let currentListing: RecordListing;

  function CaptureListing({
    onCapture,
    ...props
  }: {
    filterCondition: string;
    startIso: string;
    onCapture: (listing: RecordListing) => void;
  }) {
    onCapture(useRecordListing(props));
    return null;
  }

  function renderListing({
    filterCondition = "span_kind == 'LLM'",
    startIso = "2026-11-10T19:12:55.000Z",
  }: {
    filterCondition?: string;
    startIso?: string;
  } = {}) {
    act(() =>
      root.render(
        <CaptureListing
          filterCondition={filterCondition}
          startIso={startIso}
          onCapture={(listing) => (currentListing = listing)}
        />
      )
    );
  }

  function showMoreAfterFirstPage() {
    const rows = currentListing.appendLoadedRows(makeRows(FIRST_PAGE_NAMES));
    act(() => currentListing.showMore(rows));
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
    renderListing();
    showMoreAfterFirstPage();

    const arrivedNames = makeNames({ prefix: "arrived", count: 5 });
    const olderNames = makeNames({ prefix: "older", count: 5 });
    const rows = currentListing.appendLoadedRows(
      makeRows([...arrivedNames, ...FIRST_PAGE_NAMES, ...olderNames])
    );

    expect(currentListing.limit).toBe(2 * RECORD_PAGE_SIZE);
    expect(rows.map(({ name }) => name)).toEqual([
      ...FIRST_PAGE_NAMES,
      ...arrivedNames,
      ...olderNames,
    ]);
  });

  it("shows a listed row as the wider read returns it, and keeps one the wider read no longer reaches", () => {
    renderListing();
    showMoreAfterFirstPage();

    const refreshedRow = {
      ...makeRows(["listed-0"])[0],
      snippet: "refreshed",
    };
    const rows = currentListing.appendLoadedRows([
      ...makeRows(makeNames({ prefix: "arrived", count: 19 })),
      refreshedRow,
    ]);

    expect(
      rows.slice(0, FIRST_PAGE_NAMES.length).map(({ name }) => name)
    ).toEqual(FIRST_PAGE_NAMES);
    expect(rows[0]).toBe(refreshedRow);
    expect(rows).toHaveLength(FIRST_PAGE_NAMES.length + 19);
  });

  it.each([
    { change: "filter", next: { filterCondition: "span_kind == 'TOOL'" } },
    { change: "time window", next: { startIso: "2026-11-09T20:12:55.000Z" } },
  ])("starts again at the first page when the $change changes", ({ next }) => {
    renderListing();
    showMoreAfterFirstPage();

    renderListing(next);
    const loadedRows = makeRows(makeNames({ prefix: "other", count: 10 }));

    expect(currentListing.limit).toBe(RECORD_PAGE_SIZE);
    expect(currentListing.appendLoadedRows(loadedRows)).toEqual(loadedRows);
  });

  it("starts at the first page on going back to an earlier filter", () => {
    renderListing();
    showMoreAfterFirstPage();

    renderListing({ filterCondition: "span_kind == 'TOOL'" });
    renderListing();

    expect(currentListing.limit).toBe(RECORD_PAGE_SIZE);
  });
});
