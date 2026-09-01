import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_EVAL_MODEL } from "../model.js";
import {
  assertSingleCellAxes,
  buildExperimentName,
  buildSweepCoordinates,
  buildSweepEnv,
  DEFAULT_DATA_FORMAT,
  DEFAULT_PROMPT_TECHNIQUE,
  listEvaluators,
  resolveEvalFile,
  resolveSweepPlan,
  splitCsvList,
  SweepCliError,
} from "./config.js";
import { parseSweepArgs } from "./parseArgs.js";

function writeEvalFiles({ ids }: { ids: string[] }): string {
  const srcDir = mkdtempSync(join(tmpdir(), "evals-sweep-"));
  for (const id of ids) {
    writeFileSync(join(srcDir, `${id}.eval.ts`), "");
  }
  return srcDir;
}

describe("splitCsvList", () => {
  it("returns an empty list for omitted or blank flags", () => {
    expect(splitCsvList(undefined)).toEqual([]);
    expect(splitCsvList("  ")).toEqual([]);
  });

  it("splits and trims tokens", () => {
    expect(splitCsvList("gpt-4o-mini, gpt-4o, claude-sonnet-5")).toEqual([
      "gpt-4o-mini",
      "gpt-4o",
      "claude-sonnet-5",
    ]);
  });
});

describe("parseSweepArgs", () => {
  it("parses the reserved axis flags and evaluator", () => {
    expect(
      parseSweepArgs([
        "--evaluator",
        "toxicity",
        "--models",
        "gpt-4o-mini",
        "--prompts",
        "zero-shot",
        "--formats",
        "raw",
      ])
    ).toEqual({
      help: false,
      evaluator: "toxicity",
      models: "gpt-4o-mini",
      prompts: "zero-shot",
      formats: "raw",
    });
  });

  it("sets help from -h", () => {
    expect(parseSweepArgs(["-h"]).help).toBe(true);
  });

  it("strips a leading -- forwarded by the package manager", () => {
    expect(parseSweepArgs(["--", "--evaluator", "toxicity"]).evaluator).toBe(
      "toxicity"
    );
  });

  it("wraps unknown flags in SweepCliError", () => {
    expect(() => parseSweepArgs(["--nope"])).toThrow(SweepCliError);
  });
});

describe("listEvaluators / resolveEvalFile", () => {
  it("maps an evaluator id to src/<id>.eval.ts", () => {
    const srcDir = writeEvalFiles({
      ids: ["toxicity", "hallucination", "pii_detection.synthetic"],
    });
    expect(listEvaluators({ srcDir })).toEqual([
      "hallucination",
      "pii_detection.synthetic",
      "toxicity",
    ]);
    expect(resolveEvalFile({ evaluator: "toxicity", srcDir })).toBe(
      join("src", "toxicity.eval.ts")
    );
  });

  it("errors with known ids when the evaluator is unknown", () => {
    const srcDir = writeEvalFiles({ ids: ["toxicity"] });
    expect(() => resolveEvalFile({ evaluator: "nope", srcDir })).toThrow(
      SweepCliError
    );
    expect(() => resolveEvalFile({ evaluator: "nope", srcDir })).toThrow(
      /Known: toxicity/
    );
  });
});

describe("assertSingleCellAxes", () => {
  it("allows omitted or single-value axes", () => {
    expect(() =>
      assertSingleCellAxes({ models: [], prompts: [], formats: [] })
    ).not.toThrow();
    expect(() =>
      assertSingleCellAxes({
        models: ["gpt-4o-mini"],
        prompts: ["zero-shot"],
        formats: ["raw"],
      })
    ).not.toThrow();
  });

  it("rejects a matrix", () => {
    expect(() =>
      assertSingleCellAxes({
        models: ["gpt-4o-mini", "gpt-4o"],
        prompts: ["zero-shot", "few-shot"],
        formats: ["raw", "messages"],
      })
    ).toThrow(/not implemented yet/);
  });
});

describe("coordinates and env", () => {
  it("stamps the baked-in default cell", () => {
    const coordinates = buildSweepCoordinates({
      evalModelName: DEFAULT_EVAL_MODEL,
    });
    expect(coordinates).toEqual({
      model: DEFAULT_EVAL_MODEL,
      promptTechnique: DEFAULT_PROMPT_TECHNIQUE,
      dataFormat: DEFAULT_DATA_FORMAT,
    });
    expect(buildExperimentName({ evaluator: "toxicity", coordinates })).toBe(
      "toxicity / gpt-4o-mini / default / default"
    );
    expect(buildSweepEnv({ experimentName: "n", coordinates })).toEqual({
      PHOENIX_EXPERIMENT_NAME: "n",
      PHOENIX_EXPERIMENT_METADATA: JSON.stringify(coordinates),
    });
  });
});

describe("resolveSweepPlan", () => {
  it("requires --evaluator and plans a single vitest file", () => {
    const srcDir = writeEvalFiles({ ids: ["toxicity"] });
    expect(() => resolveSweepPlan({ flags: { help: false }, srcDir })).toThrow(
      /Missing required --evaluator/
    );

    const plan = resolveSweepPlan({
      flags: { help: false, evaluator: "toxicity" },
      srcDir,
      evalModelName: "gpt-4o-mini",
    });
    expect(plan.evalFile).toBe(join("src", "toxicity.eval.ts"));
    expect(plan.experimentName).toBe(
      "toxicity / gpt-4o-mini / default / default"
    );
    expect(plan.experimentMetadata).toEqual({
      model: "gpt-4o-mini",
      promptTechnique: "default",
      dataFormat: "default",
    });
  });

  it("errors when axis flags request a matrix", () => {
    const srcDir = writeEvalFiles({ ids: ["toxicity"] });
    expect(() =>
      resolveSweepPlan({
        flags: {
          help: false,
          evaluator: "toxicity",
          models: "gpt-4o-mini,gpt-4o,claude-sonnet-5",
          prompts: "zero-shot,few-shot",
          formats: "raw,messages",
        },
        srcDir,
      })
    ).toThrow(/not implemented yet/);
  });
});
