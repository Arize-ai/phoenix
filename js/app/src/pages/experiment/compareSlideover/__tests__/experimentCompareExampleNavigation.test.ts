import {
  findNavigationItemIndex,
  formatExamplePosition,
  getExperimentExampleCount,
  resolveExampleNavigation,
} from "../experimentCompareExampleNavigation";

const items = [{ exampleId: "ex-1" }, { exampleId: "ex-2" }];

describe("resolveExampleNavigation", () => {
  it("selects a loaded neighbor", () => {
    expect(
      resolveExampleNavigation({ items, targetIndex: 1, hasMoreItems: true })
    ).toEqual({ type: "select", item: { exampleId: "ex-2" } });
  });

  it("asks for the next page when next is pressed on the last loaded stop", () => {
    expect(
      resolveExampleNavigation({ items, targetIndex: 2, hasMoreItems: true })
    ).toEqual({ type: "load-more" });
  });

  it("stops at the end of the list when the server has no more", () => {
    expect(
      resolveExampleNavigation({ items, targetIndex: 2, hasMoreItems: false })
    ).toEqual({ type: "none" });
  });

  it("stops before the first stop", () => {
    expect(
      resolveExampleNavigation({ items, targetIndex: -1, hasMoreItems: true })
    ).toEqual({ type: "none" });
  });
});

describe("findNavigationItemIndex", () => {
  it("is -1 for an example that is not loaded", () => {
    expect(
      findNavigationItemIndex({
        items,
        selectedExampleId: "ex-99",
        baseRepetitionNumber: 1,
      })
    ).toBe(-1);
  });

  it("matches the stop for the base repetition shown when stops are runs", () => {
    const runItems = [
      { exampleId: "ex-1", baseRepetitionNumber: 1 },
      { exampleId: "ex-1", baseRepetitionNumber: 2 },
      { exampleId: "ex-2", baseRepetitionNumber: 1 },
    ];
    expect(
      findNavigationItemIndex({
        items: runItems,
        selectedExampleId: "ex-1",
        baseRepetitionNumber: 2,
      })
    ).toBe(1);
  });

  it("falls back to the example's first stop when its repetition is not loaded", () => {
    const runItems = [
      { exampleId: "ex-1", baseRepetitionNumber: 1 },
      { exampleId: "ex-2", baseRepetitionNumber: 3 },
    ];
    expect(
      findNavigationItemIndex({
        items: runItems,
        selectedExampleId: "ex-2",
        baseRepetitionNumber: 1,
      })
    ).toBe(1);
  });
});

describe("formatExamplePosition", () => {
  it("reads against the server total, not the loaded count", () => {
    expect(
      formatExamplePosition({
        currentIndex: 6,
        loadedCount: 50,
        totalCount: 312,
        hasMoreItems: true,
      })
    ).toBe("7 / 312");
  });

  it("marks the loaded count as a lower bound when there is no server total", () => {
    expect(
      formatExamplePosition({
        currentIndex: 2,
        loadedCount: 50,
        totalCount: null,
        hasMoreItems: true,
      })
    ).toBe("3 / 50+");
    expect(
      formatExamplePosition({
        currentIndex: 2,
        loadedCount: 12,
        totalCount: null,
        hasMoreItems: false,
      })
    ).toBe("3 / 12");
  });

  it("has no position for an example that is not loaded", () => {
    expect(
      formatExamplePosition({
        currentIndex: -1,
        loadedCount: 50,
        totalCount: 312,
        hasMoreItems: true,
      })
    ).toBe("– / 312");
  });
});

describe("getExperimentExampleCount", () => {
  it("divides the expected runs by the repetitions", () => {
    expect(
      getExperimentExampleCount({ expectedRunCount: 936, repetitions: 3 })
    ).toBe(312);
  });

  it("treats a repetition count below 1 as 1", () => {
    expect(
      getExperimentExampleCount({ expectedRunCount: 24, repetitions: 0 })
    ).toBe(24);
  });
});
