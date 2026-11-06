import type { LoaderFunctionArgs } from "react-router";
import type { MockEnvironment } from "relay-test-utils";
import { MockPayloadGenerator } from "relay-test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import {
  PROJECT_EVALUATOR_CRUMB_FALLBACK,
  projectEvaluatorDetailsLoader,
} from "../projectEvaluatorDetailsLoader";

// The loader fetches through the app's one environment; the test answers it.
vi.mock("@phoenix/RelayEnvironment", async () => {
  const { createMockEnvironment } = await import("relay-test-utils");
  return { default: createMockEnvironment() };
});
const environment = RelayEnvironment as unknown as MockEnvironment;

function runLoader(projectEvaluatorId = "pe1") {
  return projectEvaluatorDetailsLoader({
    params: { projectEvaluatorId },
    request: new Request(
      `http://localhost/projects/p1/evaluators/${projectEvaluatorId}`
    ),
  } as unknown as LoaderFunctionArgs);
}

/** Answers every request the loader sent; the query ref and the name share one. */
function settleOperations(settle: "resolve" | "reject") {
  for (const operation of environment.mock.getAllOperations()) {
    if (settle === "resolve") {
      environment.mock.resolve(
        operation,
        MockPayloadGenerator.generate(operation, {
          Node: () => ({ __typename: "ProjectEvaluator" }),
          ProjectEvaluator: () => ({ name: "Toxicity" }),
        })
      );
    } else {
      environment.mock.reject(
        operation,
        new Error(
          'Error fetching GraphQL query \'projectEvaluatorDetailsLoaderQuery\': [{"message":"Unknown node: pe1"}]'
        )
      );
    }
  }
}

describe("projectEvaluatorDetailsLoader", () => {
  beforeEach(() => {
    environment.mock.clearCache();
  });

  it("returns at once, with the query ref and the name still loading", () => {
    const loaderData = runLoader();
    expect(loaderData).not.toBeInstanceOf(Promise);
    expect(loaderData.queryRef.variables).toEqual({
      projectEvaluatorId: "pe1",
    });
    expect(loaderData.evaluatorDisplayName).toBeInstanceOf(Promise);
    // The name shares the query ref's request rather than sending its own.
    expect(environment.mock.getAllOperations()).toHaveLength(1);
  });

  it("resolves the breadcrumb to the evaluator's name", async () => {
    const loaderData = runLoader();
    settleOperations("resolve");
    await expect(loaderData.evaluatorDisplayName).resolves.toBe("Toxicity");
  });

  it("resolves the breadcrumb to the generic crumb when the lookup fails", async () => {
    const loaderData = runLoader("stale");
    settleOperations("reject");
    await expect(loaderData.evaluatorDisplayName).resolves.toBe(
      PROJECT_EVALUATOR_CRUMB_FALLBACK
    );
  });
});
