/**
 * Regression tests for the `PHOENIX_TEST_TRACKING` gate (issue #13930).
 *
 * The flag is meant to reliably disable all syncing to Phoenix. These tests
 * pin down the two failure modes that let recording leak through:
 *   1. the flag value being read as truthy when wrapped in quotes / whitespace, and
 *   2. one suite re-enabling recording for the others by mutating the env var
 *      mid-run (recording is process-wide and opt-out, so it must latch off).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetTrackingLatchForTests,
  isFalsyFlag,
  isTrackingEnabled,
  mergeExperimentMetadata,
  parseExperimentMetadataEnv,
  postAnnotation,
  postExperimentRun,
  resolveExperimentName,
} from "../../src/testing/phoenix-test-tracking";
import type { RunState, SuiteState } from "../../src/testing/state";

const ENV_KEY = "PHOENIX_TEST_TRACKING";
const original = process.env[ENV_KEY];

function setFlag(value: string | undefined): void {
  if (value === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = value;
  }
  // Re-sync the process-level latch to the new value so each assertion starts
  // from a clean slate (the latch is intentionally sticky within a process).
  __resetTrackingLatchForTests();
}

afterEach(() => {
  setFlag(original);
});

describe("isFalsyFlag", () => {
  it.each(["false", "0", "off", "no", "FALSE", "Off", "No"])(
    "treats %j as falsy",
    (value) => {
      expect(isFalsyFlag(value)).toBe(true);
    }
  );

  it.each(['"false"', "'false'", "  false  ", '"false"\n', " 0 "])(
    "tolerates surrounding quotes / whitespace: %j",
    (value) => {
      expect(isFalsyFlag(value)).toBe(true);
    }
  );

  it.each([undefined, "", "true", "1", "on", "yes", "anything"])(
    "treats %j as truthy",
    (value) => {
      expect(isFalsyFlag(value)).toBe(false);
    }
  );
});

describe("isTrackingEnabled", () => {
  it("is enabled by default when the flag is unset", () => {
    setFlag(undefined);
    expect(isTrackingEnabled().enabled).toBe(true);
  });

  it("is disabled when the flag is falsy", () => {
    setFlag("false");
    const result = isTrackingEnabled();
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("PHOENIX_TEST_TRACKING is disabled");
  });

  it("is disabled for a quoted falsy value", () => {
    setFlag('"false"');
    expect(isTrackingEnabled().enabled).toBe(false);
  });

  it("is disabled per-suite via dryRun while the flag stays truthy", () => {
    setFlag("true");
    const suite = { config: { dryRun: true } } as SuiteState;
    const result = isTrackingEnabled(suite);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("suite configured dryRun");
    // A dryRun suite must not latch tracking off for the whole process.
    expect(isTrackingEnabled().enabled).toBe(true);
  });

  it("stays disabled once seen falsy, even if the env var is later flipped truthy", () => {
    // Suite A observes the flag as disabled.
    setFlag("false");
    expect(isTrackingEnabled().enabled).toBe(false);

    // A sibling suite (or setup file) mutates the env var mid-run. Recording
    // is process-wide, so it must not turn back on for later suites.
    process.env[ENV_KEY] = "true";
    expect(isTrackingEnabled().enabled).toBe(false);

    // Deleting the var entirely must not re-enable it either.
    delete process.env[ENV_KEY];
    expect(isTrackingEnabled().enabled).toBe(false);
  });
});

describe("upload guards honor the flag", () => {
  beforeEach(() => {
    setFlag("false");
  });

  function trackingSuite(): {
    suite: SuiteState;
    post: ReturnType<typeof vi.fn>;
  } {
    // A suite that *looks* fully initialized for recording (client +
    // experiment id, tracking not flagged off on the suite itself). The only
    // thing that should keep it from uploading is the disabled env flag.
    const post = vi.fn().mockResolvedValue({ data: { data: { id: "run-1" } } });
    const suite = {
      name: "leaky suite",
      config: {},
      registeredExamples: new Map(),
      exampleIdsByTest: new Map([
        ["case", { exampleId: "ex-1", nodeId: "node-1" }],
      ]),
      trackingDisabled: false,
      results: [],
      links: [],
      experimentId: "exp-1",
      client: { POST: post } as unknown as SuiteState["client"],
    } as SuiteState;
    return { suite, post };
  }

  function runState(suite: SuiteState): RunState {
    return {
      suite,
      testName: "case",
      logicalName: "case",
      repetitionNumber: 1,
      dryRun: false,
      params: { input: { q: "hi" } },
      output: { a: "ok" },
      outputSet: true,
      annotations: [],
      startTime: new Date(),
      runMetadata: {},
    };
  }

  it("postExperimentRun does not POST when tracking is disabled", async () => {
    const { suite, post } = trackingSuite();
    const result = await postExperimentRun(suite, runState(suite));
    expect(result).toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });

  it("postAnnotation does not POST when tracking is disabled", async () => {
    const { suite, post } = trackingSuite();
    await postAnnotation(suite, "run-1", { name: "pass", score: 1 });
    expect(post).not.toHaveBeenCalled();
  });
});

describe("resolveExperimentName", () => {
  it("prefers a non-empty env name over config and suite name", () => {
    expect(
      resolveExperimentName({
        suiteName: "suite",
        experimentName: "from-config",
        datasetName: "from-dataset",
        envName: "  from-env  ",
      })
    ).toBe("from-env");
  });

  it("falls through an empty env name to experimentName, then datasetName, then suite", () => {
    expect(
      resolveExperimentName({
        suiteName: "suite",
        experimentName: "from-config",
        datasetName: "from-dataset",
        envName: "   ",
      })
    ).toBe("from-config");
    expect(
      resolveExperimentName({
        suiteName: "suite",
        datasetName: "from-dataset",
        envName: "",
      })
    ).toBe("from-dataset");
    expect(resolveExperimentName({ suiteName: "suite", envName: "" })).toBe(
      "suite"
    );
  });
});

describe("parseExperimentMetadataEnv", () => {
  it("returns an empty object when unset or blank", () => {
    expect(parseExperimentMetadataEnv({ raw: undefined })).toEqual({});
    expect(parseExperimentMetadataEnv({ raw: "  " })).toEqual({});
  });

  it("parses a JSON object", () => {
    expect(
      parseExperimentMetadataEnv({
        raw: '{"model":"gpt-4o-mini","promptTechnique":"default"}',
      })
    ).toEqual({ model: "gpt-4o-mini", promptTechnique: "default" });
  });

  it("rejects invalid JSON and non-objects", () => {
    expect(() => parseExperimentMetadataEnv({ raw: "{" })).toThrow(
      /must be a JSON object/
    );
    expect(() => parseExperimentMetadataEnv({ raw: "[]" })).toThrow(
      /must be a JSON object/
    );
    expect(() => parseExperimentMetadataEnv({ raw: '"str"' })).toThrow(
      /must be a JSON object/
    );
  });
});

describe("mergeExperimentMetadata", () => {
  it("lets the overlay win over suite metadata, then applies environment", () => {
    expect(
      mergeExperimentMetadata({
        suiteMetadata: { model: "suite-model", extra: 1 },
        overlay: { model: "overlay-model", promptTechnique: "default" },
        environmentMetadata: { environment: "test" },
      })
    ).toEqual({
      model: "overlay-model",
      extra: 1,
      promptTechnique: "default",
      environment: "test",
    });
  });
});
