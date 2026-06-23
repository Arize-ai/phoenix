import {
  afterAll as vitestAfterAll,
  beforeAll as vitestBeforeAll,
  describe as vitestDescribe,
  test as vitestTest,
} from "vitest";

import { createTestApi } from "../testing/define-api";
import type { RunnerHooks } from "../testing/runner";

export type {
  PhoenixDescribe,
  PhoenixTest,
  PhoenixTestApi,
  PhoenixTestEach,
} from "../testing/define-api";

export type {
  AcceptanceCriterion,
  AcceptanceMetric,
  AcceptanceResult,
  Annotation,
  AnnotatorKind,
  EvaluationParams,
  EvaluationResult,
  Evaluator,
  EvaluatorResult,
  KVMap,
  ReferenceOutput,
  SuiteConfig,
  TestArgs,
  TestConfig,
  TestEachRow,
  TestFn,
  TestParams,
  TestParamsBase,
} from "../testing/types";

export {
  evaluate,
  logAnnotation,
  logOutput,
  traceEvaluator,
} from "../testing/helpers";

const hooks: RunnerHooks = {
  describe: vitestDescribe,
  describeOnly: vitestDescribe,
  describeSkip: vitestDescribe.skip,
  test: vitestTest,
  testOnly: vitestTest.only,
  testSkip: vitestTest.skip,
  beforeAll: vitestBeforeAll,
  afterAll: vitestAfterAll,
};

export const { describe, test, it } = createTestApi(() => hooks);
