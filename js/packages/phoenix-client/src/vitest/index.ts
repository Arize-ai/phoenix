import {
  afterAll as vitestAfterAll,
  beforeAll as vitestBeforeAll,
  describe as vitestDescribe,
  test as vitestTest,
} from "vitest";

import { createTestApi } from "../testing/define-api";
import type { RunnerHooks } from "../testing/runner";

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
  SuiteConfig,
  TestArgs,
  TestConfig,
  TestEachRow,
  TestFn,
  TestParams,
} from "../testing/types";

export {
  evaluate,
  logAnnotation,
  recordOutput,
  traceEvaluator,
} from "../testing/helpers";

const hooks: RunnerHooks = {
  describe: (name, fn) => vitestDescribe(name, fn),
  describeOnly: (name, fn) => vitestDescribe.only(name, fn),
  describeSkip: (name, fn) => vitestDescribe.skip(name, fn),
  test: (name, fn, timeout) => vitestTest(name, fn, timeout),
  testOnly: (name, fn, timeout) => vitestTest.only(name, fn, timeout),
  testSkip: (name, fn, timeout) => vitestTest.skip(name, fn, timeout),
  beforeAll: (fn) => vitestBeforeAll(fn),
  afterAll: (fn) => vitestAfterAll(fn),
};

export const { describe, test, it } = createTestApi(() => hooks);
