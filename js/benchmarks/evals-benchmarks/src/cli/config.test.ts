import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_EVAL_MODEL } from "../resolveEvalModel.js";
import {
  assertPromptTechniques,
  assertSingleValueAxes,
  buildExperimentName,
  buildSweepCoordinates,
  buildSweepEnv,
  DEFAULT_DATA_FORMAT,
  DEFAULT_PROMPT_TECHNIQUE,
  listEvaluators,
  listPromptTechniques,
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
  it("allows omitted or single-value format", () => {
    expect(() => assertSingleValueAxes({ formats: [] })).not.toThrow();
    expect(() => assertSingleValueAxes({ formats: ["raw"] })).not.toThrow();
  });

  it("rejects a format matrix", () => {
    expect(() =>
      assertSingleValueAxes({
        formats: ["raw", "messages"],
      })
    ).toThrow(/not implemented yet/);
  });
});

describe("assertPromptTechniques", () => {
  it("allows default for every evaluator and few-shot for toxicity", () => {
    expect(listPromptTechniques({ evaluator: "toxicity" })).toEqual([
      "default",
      "few-shot",
    ]);
    expect(listPromptTechniques({ evaluator: "hallucination" })).toEqual([
      "default",
    ]);
    expect(() =>
      assertPromptTechniques({
        evaluator: "toxicity",
        prompts: ["default", "few-shot"],
      })
    ).not.toThrow();
  });

  it("rejects few-shot on evaluators without a template", () => {
    expect(() =>
      assertPromptTechniques({
        evaluator: "hallucination",
        prompts: ["few-shot"],
      })
    ).toThrow(/Unsupported prompt technique/);
  });
});

describe("coordinates and env", () => {
  it("stamps the cell model and prompt and sets env for the child process", () => {
    const coordinates = buildSweepCoordinates({
      evalModelName: DEFAULT_EVAL_MODEL,
      promptTechnique: "few-shot",
    });
    expect(coordinates).toEqual({
      model: DEFAULT_EVAL_MODEL,
      promptTechnique: "few-shot",
      dataFormat: DEFAULT_DATA_FORMAT,
    });
    expect(buildExperimentName({ evaluator: "toxicity", coordinates })).toBe(
      "toxicity / gpt-4o-mini / few-shot / default"
    );
    expect(buildSweepEnv({ experimentName: "n", coordinates })).toEqual({
      EVAL_MODEL: DEFAULT_EVAL_MODEL,
      EVAL_PROMPT_TECHNIQUE: "few-shot",
      PHOENIX_EXPERIMENT_NAME: "n",
      PHOENIX_EXPERIMENT_METADATA: JSON.stringify(coordinates),
    });
  });

  it("defaults promptTechnique when omitted", () => {
    expect(
      buildSweepCoordinates({ evalModelName: DEFAULT_EVAL_MODEL })
        .promptTechnique
    ).toBe(DEFAULT_PROMPT_TECHNIQUE);
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

  it("emits one plan per --models value when --prompts is omitted", () => {
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

  it("emits a cartesian product of --models and --prompts", () => {
    const srcDir = writeEvalFiles({ ids: ["toxicity"] });
    const plans = resolveSweepPlans({
      flags: {
        help: false,
        evaluator: "toxicity",
        models: "gpt-4o-mini,gpt-4o",
        prompts: "default,few-shot",
      },
      srcDir,
    });
    expect(plans.map((plan) => plan.experimentName)).toEqual([
      "toxicity / gpt-4o-mini / default / default",
      "toxicity / gpt-4o-mini / few-shot / default",
      "toxicity / gpt-4o / default / default",
      "toxicity / gpt-4o / few-shot / default",
    ]);
    expect(
      buildSweepEnv({
        experimentName: plans[1]!.experimentName,
        coordinates: plans[1]!.coordinates,
      }).EVAL_PROMPT_TECHNIQUE
    ).toBe("few-shot");
  });

  it("errors when --formats request a matrix", () => {
    const srcDir = writeEvalFiles({ ids: ["toxicity"] });
    expect(() =>
      resolveSweepPlans({
        flags: {
          help: false,
          evaluator: "toxicity",
          formats: "raw,messages",
        },
        srcDir,
      })
    ).toThrow(/not implemented yet/);
  });

  it("errors when few-shot is requested for another evaluator", () => {
    const srcDir = writeEvalFiles({ ids: ["hallucination"] });
    expect(() =>
      resolveSweepPlans({
        flags: {
          help: false,
          evaluator: "hallucination",
          prompts: "few-shot",
        },
        srcDir,
      })
    ).toThrow(/Unsupported prompt technique/);
  });
});
