import {
  applyExperimentCompareSlideoverState,
  parseExperimentCompareSlideoverState,
  resolveCompareLaneExperimentId,
} from "../experimentCompareSlideoverSearchParams";

describe("parseExperimentCompareSlideoverState", () => {
  it("reads a closed slideover with defaults from an unrelated URL", () => {
    expect(
      parseExperimentCompareSlideoverState(
        new URLSearchParams("experimentId=a&experimentId=b&view=grid")
      )
    ).toEqual({
      selectedExampleId: null,
      compareLaneExperimentId: null,
      mode: "details",
      baseRepetitionNumber: 1,
      compareRepetitionNumber: 1,
    });
  });

  it("restores every field a copied URL carries", () => {
    expect(
      parseExperimentCompareSlideoverState(
        new URLSearchParams(
          "selectedExampleId=ex-7&compareLaneExperimentId=exp-c&detailsMode=traces&baseRepetition=2&compareRepetition=3"
        )
      )
    ).toEqual({
      selectedExampleId: "ex-7",
      compareLaneExperimentId: "exp-c",
      mode: "traces",
      baseRepetitionNumber: 2,
      compareRepetitionNumber: 3,
    });
  });

  it.each(["0", "-2", "1.5", "abc", ""])(
    "falls back to repetition 1 for the malformed value %j",
    (value) => {
      const state = parseExperimentCompareSlideoverState(
        new URLSearchParams({ baseRepetition: value })
      );
      expect(state.baseRepetitionNumber).toBe(1);
    }
  );

  it("falls back to details for an unknown mode", () => {
    const state = parseExperimentCompareSlideoverState(
      new URLSearchParams("detailsMode=spans")
    );
    expect(state.mode).toBe("details");
  });
});

describe("applyExperimentCompareSlideoverState", () => {
  it("round-trips a state through the URL", () => {
    const state = {
      selectedExampleId: "ex-7",
      compareLaneExperimentId: "exp-c",
      mode: "traces",
      baseRepetitionNumber: 2,
      compareRepetitionNumber: 3,
    } as const;
    const searchParams = applyExperimentCompareSlideoverState({
      searchParams: new URLSearchParams(),
      changes: state,
    });
    expect(parseExperimentCompareSlideoverState(searchParams)).toEqual(state);
  });

  it("keeps unrelated params and fields it was not asked to change", () => {
    const searchParams = applyExperimentCompareSlideoverState({
      searchParams: new URLSearchParams(
        "experimentId=a&experimentId=b&selectedExampleId=ex-1&compareLaneExperimentId=b"
      ),
      changes: { selectedExampleId: "ex-2" },
    });
    expect(searchParams.getAll("experimentId")).toEqual(["a", "b"]);
    expect(searchParams.get("selectedExampleId")).toBe("ex-2");
    expect(searchParams.get("compareLaneExperimentId")).toBe("b");
  });

  it("drops default values from the URL", () => {
    const searchParams = applyExperimentCompareSlideoverState({
      searchParams: new URLSearchParams(
        "selectedExampleId=ex-1&detailsMode=traces&baseRepetition=4&compareRepetition=2"
      ),
      changes: {
        selectedExampleId: null,
        mode: "details",
        baseRepetitionNumber: 1,
        compareRepetitionNumber: 1,
      },
    });
    expect(searchParams.toString()).toBe("");
  });

  it("does not mutate the params it was given", () => {
    const original = new URLSearchParams("selectedExampleId=ex-1");
    applyExperimentCompareSlideoverState({
      searchParams: original,
      changes: { selectedExampleId: "ex-2" },
    });
    expect(original.get("selectedExampleId")).toBe("ex-1");
  });
});

describe("resolveCompareLaneExperimentId", () => {
  it("keeps the requested experiment while it is still compared", () => {
    expect(
      resolveCompareLaneExperimentId({
        requestedExperimentId: "c",
        compareExperimentIds: ["b", "c", "d"],
      })
    ).toBe("c");
  });

  it("falls back to the first compared experiment when the requested one was removed", () => {
    expect(
      resolveCompareLaneExperimentId({
        requestedExperimentId: "z",
        compareExperimentIds: ["b", "c"],
      })
    ).toBe("b");
  });

  it("is null when only the base experiment is selected", () => {
    expect(
      resolveCompareLaneExperimentId({
        requestedExperimentId: "b",
        compareExperimentIds: [],
      })
    ).toBeNull();
  });
});
