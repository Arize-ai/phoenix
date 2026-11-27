import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";

import {
  buildLaneAnnotationRow,
  capRepetitionCells,
  computeAnnotationRowDelta,
  computeLabelMode,
  getAnnotationNameUnion,
} from "../experimentCompareAnnotationRows";

function buildScore(score: number) {
  return { name: "correctness", score, label: null };
}

function buildLabel(label: string) {
  return { name: "tone", score: null, label };
}

const maximizeConfig: AnnotationOptimizationConfig = {
  annotationType: "CONTINUOUS",
  optimizationDirection: "MAXIMIZE",
};

const minimizeConfig: AnnotationOptimizationConfig = {
  annotationType: "CONTINUOUS",
  optimizationDirection: "MINIMIZE",
};

describe("computeAnnotationRowDelta", () => {
  it("counts a higher score as improved when the config maximizes", () => {
    expect(
      computeAnnotationRowDelta({
        baseAnnotation: buildScore(0.5),
        compareAnnotation: buildScore(0.8),
        config: maximizeConfig,
      })
    ).toMatchObject({
      type: "score",
      delta: { kind: "changed", sign: "up", direction: "improved" },
    });
  });

  it("counts a higher score as regressed when the config minimizes", () => {
    expect(
      computeAnnotationRowDelta({
        baseAnnotation: buildScore(0.5),
        compareAnnotation: buildScore(0.8),
        config: minimizeConfig,
      })
    ).toMatchObject({
      type: "score",
      delta: { kind: "changed", sign: "up", direction: "regressed" },
    });
  });

  it.each([
    ["no config", undefined],
    [
      "a config with no direction",
      { annotationType: "CONTINUOUS", optimizationDirection: "NONE" } as const,
    ],
  ])("is neutral with %s", (_description, config) => {
    expect(
      computeAnnotationRowDelta({
        baseAnnotation: buildScore(0.5),
        compareAnnotation: buildScore(0.8),
        config,
      })
    ).toMatchObject({
      type: "score",
      delta: { kind: "changed", direction: "neutral" },
    });
  });

  it("has nothing to compare when a lane lacks the annotation", () => {
    expect(
      computeAnnotationRowDelta({
        baseAnnotation: null,
        compareAnnotation: buildScore(0.8),
        config: maximizeConfig,
      })
    ).toEqual({ type: "score", delta: { kind: "undefined" } });
  });

  it("compares annotations without scores as labels", () => {
    expect(
      computeAnnotationRowDelta({
        baseAnnotation: buildLabel("neutral"),
        compareAnnotation: buildLabel("formal"),
        config: undefined,
      })
    ).toEqual({
      type: "label",
      delta: {
        kind: "changed",
        baseLabel: "neutral",
        compareLabel: "formal",
        direction: "neutral",
      },
    });
  });
});

describe("buildLaneAnnotationRow", () => {
  const scoreRuns = [
    { repetitionNumber: 2, error: null, annotations: [buildScore(1)] },
    { repetitionNumber: 1, error: null, annotations: [buildScore(0)] },
    { repetitionNumber: 3, error: null, annotations: [] },
  ];

  it("shows the selected repetition's value and averages the scored ones", () => {
    const row = buildLaneAnnotationRow({
      annotationName: "correctness",
      runs: scoreRuns,
      shownRepetitionNumber: 2,
    });
    expect(row.kind).toBe("score");
    expect(row.valueText).toBe("1.00");
    expect(row.averageText).toBe("0.50");
    expect(row.scorePercent).toBe(100);
  });

  it("orders cells by repetition, marks the shown one, and fills by score", () => {
    const row = buildLaneAnnotationRow({
      annotationName: "correctness",
      runs: scoreRuns,
      shownRepetitionNumber: 2,
    });
    expect(
      row.repetitionCells.map((cell) => [
        cell.repetitionNumber,
        cell.isShown,
        cell.hasValue,
      ])
    ).toEqual([
      [1, false, true],
      [2, true, true],
      [3, false, false],
    ]);
    const [lowest, highest, missing] = row.repetitionCells;
    expect(highest.fillOpacity).toBe(1);
    expect(lowest.fillOpacity).toBeGreaterThan(0);
    expect(lowest.fillOpacity).toBeLessThan(highest.fillOpacity);
    expect(missing.fillOpacity).toBe(0);
  });

  it("scales score fill between the experiment's min and max", () => {
    const row = buildLaneAnnotationRow({
      annotationName: "correctness",
      runs: [
        { repetitionNumber: 1, error: null, annotations: [buildScore(5)] },
      ],
      shownRepetitionNumber: 1,
      minScore: 0,
      maxScore: 10,
    });
    expect(row.scorePercent).toBe(50);
  });

  it("fills label cells that match the shown repetition's label and averages to the mode", () => {
    const row = buildLaneAnnotationRow({
      annotationName: "tone",
      runs: [
        {
          repetitionNumber: 1,
          error: null,
          annotations: [buildLabel("terse")],
        },
        {
          repetitionNumber: 2,
          error: null,
          annotations: [buildLabel("formal")],
        },
        {
          repetitionNumber: 3,
          error: null,
          annotations: [buildLabel("terse")],
        },
      ],
      shownRepetitionNumber: 3,
    });
    expect(row.kind).toBe("label");
    expect(row.valueText).toBe("terse");
    expect(row.averageText).toBe("terse");
    expect(
      row.repetitionCells.map((cell) => cell.isMatchingShownLabel)
    ).toEqual([true, false, true]);
  });

  it("is an empty row when no repetition has the annotation", () => {
    const row = buildLaneAnnotationRow({
      annotationName: "politeness",
      runs: scoreRuns,
      shownRepetitionNumber: 1,
    });
    expect(row).toMatchObject({
      kind: "empty",
      annotation: null,
      valueText: "--",
      averageText: "--",
      scorePercent: null,
    });
  });
});

describe("capRepetitionCells", () => {
  const cells = Array.from({ length: 11 }, (_unused, index) => ({
    repetitionNumber: index + 1,
    valueText: "1.00",
    isShown: false,
    fillOpacity: 1,
    isMatchingShownLabel: false,
    hasValue: true,
  }));

  it("draws 8 cells and counts the rest", () => {
    const { visibleCells, hiddenCount } = capRepetitionCells({ cells });
    expect(visibleCells).toHaveLength(8);
    expect(hiddenCount).toBe(3);
  });

  it("draws every cell at or under the cap", () => {
    const { visibleCells, hiddenCount } = capRepetitionCells({
      cells: cells.slice(0, 8),
    });
    expect(visibleCells).toHaveLength(8);
    expect(hiddenCount).toBe(0);
  });
});

describe("getAnnotationNameUnion", () => {
  it("lists the base lane's annotations first, then the ones only the compare lane has", () => {
    expect(
      getAnnotationNameUnion([
        ["correctness", "tone"],
        ["tone", "conciseness"],
      ])
    ).toEqual(["correctness", "tone", "conciseness"]);
  });
});

describe("computeLabelMode", () => {
  it("lets the earliest label win a tie", () => {
    expect(computeLabelMode(["formal", "terse"])).toBe("formal");
  });

  it("is null without labels", () => {
    expect(computeLabelMode([])).toBeNull();
  });
});
