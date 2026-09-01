import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_EVAL_MODEL } from "../resolveEvalModel.js";
import {
  assertSingleValueAxes,
  buildExperimentName,
  buildSweepCoordinates,
  buildSweepEnv,
  DEFAULT_DATA_FORMAT,
  DEFAULT_PROMPT_TECHNIQUE,
  listEvaluators,
  resolveEvalFile,
  resolveSweepPlans,
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

describe("assertSingleValueAxes", () => {
  it("allows omitted or single-value prompt/format", () => {
    expect(() =>
      assertSingleValueAxes({ prompts: [], formats: [] })
    ).not.toThrow();
    expect(() =>
      assertSingleValueAxes({
        prompts: ["zero-shot"],
        formats: ["raw"],
      })
    ).not.toThrow();
  });

  it("rejects a prompt or format matrix", () => {
    expect(() =>
      assertSingleValueAxes({
        prompts: ["zero-shot", "few-shot"],
        formats: ["raw"],
      })
    ).toThrow(/not implemented yet/);
    expect(() =>
      assertSingleValueAxes({
        prompts: ["zero-shot"],
        formats: ["raw", "messages"],
      })
    ).toThrow(/not implemented yet/);
  });
});

describe("coordinates and env", () => {
  it("stamps the cell model and sets EVAL_MODEL for the child process", () => {
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
      EVAL_MODEL: DEFAULT_EVAL_MODEL,
      PHOENIX_EXPERIMENT_NAME: "n",
      PHOENIX_EXPERIMENT_METADATA: JSON.stringify(coordinates),
    });
  });
});

describe("resolveSweepPlans", () => {
  it("requires --evaluator and plans a single vitest file when --models is omitted", () => {
    const srcDir = writeEvalFiles({ ids: ["toxicity"] });
    expect(() => resolveSweepPlans({ flags: { help: false }, srcDir })).toThrow(
      /Missing required --evaluator/
    );

    const plans = resolveSweepPlans({
      flags: { help: false, evaluator: "toxicity" },
      srcDir,
      evalModelName: "gpt-4o-mini",
    });
    expect(plans).toHaveLength(1);
    expect(plans[0]?.evalFile).toBe(join("src", "toxicity.eval.ts"));
    expect(plans[0]?.experimentName).toBe(
      "toxicity / gpt-4o-mini / default / default"
    );
    expect(plans[0]?.experimentMetadata).toEqual({
      model: "gpt-4o-mini",
      promptTechnique: "default",
      dataFormat: "default",
    });
  });

  it("emits one plan per --models value", () => {
    const srcDir = writeEvalFiles({ ids: ["toxicity"] });
    const plans = resolveSweepPlans({
      flags: {
        help: false,
        evaluator: "toxicity",
        models: "gpt-4o-mini,gpt-4o",
      },
      srcDir,
    });
    expect(plans.map((plan) => plan.experimentName)).toEqual([
      "toxicity / gpt-4o-mini / default / default",
      "toxicity / gpt-4o / default / default",
    ]);
    expect(plans.map((plan) => plan.coordinates.model)).toEqual([
      "gpt-4o-mini",
      "gpt-4o",
    ]);
    expect(
      buildSweepEnv({
        experimentName: plans[1]!.experimentName,
        coordinates: plans[1]!.coordinates,
      }).EVAL_MODEL
    ).toBe("gpt-4o");
  });

  it("errors when --prompts or --formats request a matrix", () => {
    const srcDir = writeEvalFiles({ ids: ["toxicity"] });
    expect(() =>
      resolveSweepPlans({
        flags: {
          help: false,
          evaluator: "toxicity",
          models: "gpt-4o-mini,gpt-4o",
          prompts: "zero-shot,few-shot",
        },
        srcDir,
      })
    ).toThrow(/not implemented yet/);
  });
});
