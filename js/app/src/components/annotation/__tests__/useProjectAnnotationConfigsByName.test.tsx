import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  graphql,
  RelayEnvironmentProvider,
  useLazyLoadQuery,
} from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getPositiveOptimizationFromConfig } from "../optimizationUtils";
import { useProjectAnnotationConfigsByName } from "../useProjectAnnotationConfigsByName";
import type { useProjectAnnotationConfigsByNameTestQuery } from "./__generated__/useProjectAnnotationConfigsByNameTestQuery.graphql";

function ConfigScores({ names }: { names: string[] }) {
  const data = useLazyLoadQuery<useProjectAnnotationConfigsByNameTestQuery>(
    graphql`
      query useProjectAnnotationConfigsByNameTestQuery(
        $names: [String!]
        $first: Int
      ) {
        node(id: "project-1") {
          ... on Project {
            ...ProjectAnnotationConfigsByNameFragment
              @arguments(annotationConfigNames: $names, first: $first)
          }
        }
      }
    `,
    { names, first: names.length }
  );
  const configs = useProjectAnnotationConfigsByName(data.node);
  return names.map((name) => (
    <div key={name} data-name={name}>
      {String(
        getPositiveOptimizationFromConfig({
          config: configs.get(name),
          score: 1,
        })
      )}
    </div>
  ));
}

function outputConfig({
  name = "result",
  direction = "MAXIMIZE",
  id = name,
}: {
  name?: string;
  direction?: string;
  id?: string;
} = {}) {
  return {
    __typename: "CategoricalAnnotationConfig",
    __isAnnotationConfigBase: "CategoricalAnnotationConfig",
    __isNode: "CategoricalAnnotationConfig",
    id,
    name,
    annotationType: "CATEGORICAL",
    optimizationDirection: direction,
    values: [
      { label: "no", score: 0 },
      { label: "yes", score: 1 },
    ],
  };
}

function projectEvaluator({
  name,
  outputs,
}: {
  name: string;
  outputs: ReturnType<typeof outputConfig>[];
}) {
  return {
    node: {
      id: `project-evaluator-${name}`,
      name,
      evaluator: {
        __typename: "CodeEvaluator",
        id: `evaluator-${name}`,
        outputConfigs: outputs,
      },
    },
  };
}

describe("project annotation display configs", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderScores({
    names,
    evaluators,
    configs = [],
  }: {
    names: string[];
    evaluators: ReturnType<typeof projectEvaluator>[];
    configs?: ReturnType<typeof outputConfig>[];
  }) {
    const environment = new Environment({
      network: Network.create((operation, variables) => {
        expect(operation.text).toContain(
          "evaluators(first: $first, filter: {annotationNames: $names})"
        );
        expect(variables).toEqual({ names, first: names.length });
        return Promise.resolve({
          data: {
            node: {
              __typename: "Project",
              id: "project-1",
              evaluators: { edges: evaluators },
              annotationConfigs: {
                edges: configs.map((config) => ({ config })),
              },
            },
          },
        });
      }),
      store: new Store(new RecordSource()),
    });
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <Suspense fallback="loading">
            <ConfigScores names={names} />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });
    return environment;
  }

  function scores() {
    return [...container.querySelectorAll("[data-name]")].map(
      (element) => element.textContent
    );
  }

  it("colors evaluator results without project configs and updates when the direction changes", async () => {
    const environment = await renderScores({
      names: ["correctness"],
      evaluators: [
        projectEvaluator({
          name: "correctness",
          outputs: [outputConfig({ id: "correctness-config" })],
        }),
      ],
    });
    expect(scores()).toEqual(["true"]);

    await act(async () => {
      environment.commitUpdate((store) => {
        store
          .get("correctness-config")!
          .setValue("MINIMIZE", "optimizationDirection");
      });
    });
    expect(scores()).toEqual(["false"]);
  });

  it("maps each multi-output result and keeps undirected or missing configs neutral", async () => {
    await renderScores({
      names: ["quality.correctness", "quality.toxicity", "neutral", "missing"],
      evaluators: [
        projectEvaluator({
          name: "quality",
          outputs: [
            outputConfig({ name: "correctness" }),
            outputConfig({ name: "toxicity", direction: "MINIMIZE" }),
          ],
        }),
        projectEvaluator({
          name: "neutral",
          outputs: [outputConfig({ id: "neutral-config", direction: "NONE" })],
        }),
      ],
    });
    expect(scores()).toEqual(["true", "false", "null", "null"]);
  });

  it("preserves explicit project configs when an evaluator has the same annotation name", async () => {
    await renderScores({
      names: ["manual"],
      evaluators: [
        projectEvaluator({
          name: "manual",
          outputs: [outputConfig({ id: "evaluator-config" })],
        }),
      ],
      configs: [
        outputConfig({
          name: "manual",
          direction: "MINIMIZE",
          id: "manual-config",
        }),
      ],
    });
    expect(scores()).toEqual(["false"]);
  });
});
