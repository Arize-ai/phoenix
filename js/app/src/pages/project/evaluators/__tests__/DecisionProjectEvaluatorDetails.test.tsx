import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  graphql,
  RelayEnvironmentProvider,
  useLazyLoadQuery,
} from "react-relay";
import { MemoryRouter } from "react-router";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { DecisionProjectEvaluatorDetails } from "../DecisionProjectEvaluatorDetails";
import type { DecisionProjectEvaluatorDetailsTestQuery } from "./__generated__/DecisionProjectEvaluatorDetailsTestQuery.graphql";

function DecisionProjectEvaluatorDetailsTestRenderer() {
  const data = useLazyLoadQuery<DecisionProjectEvaluatorDetailsTestQuery>(
    graphql`
      query DecisionProjectEvaluatorDetailsTestQuery @relay_test_operation {
        projectEvaluator: node(id: "test-project-evaluator-id") {
          ... on ProjectEvaluator {
            ...DecisionProjectEvaluatorDetails_projectEvaluator
          }
        }
      }
    `,
    {}
  );
  if (data.projectEvaluator == null) {
    return null;
  }
  return (
    <DecisionProjectEvaluatorDetails
      projectEvaluatorRef={data.projectEvaluator}
    />
  );
}

installTestMatchMedia();

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

describe("DecisionProjectEvaluatorDetails", () => {
  it("shows the decision, its state, questions, scoring, and input mapping", async () => {
    const environment = createMockEnvironment();
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="dark">
            <MemoryRouter>
              <Suspense fallback="loading">
                <DecisionProjectEvaluatorDetailsTestRenderer />
              </Suspense>
            </MemoryRouter>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
    await act(async () => {
      environment.mock.resolveMostRecentOperation((operation) =>
        MockPayloadGenerator.generate(operation, {
          Node: () => ({ __typename: "ProjectEvaluator" }),
          ProjectEvaluator: () => ({
            inputMapping: {
              pathMapping: { answer: "attributes.output.value" },
              literalMapping: {},
            },
          }),
          Evaluator: () => ({ __typename: "DecisionEvaluator" }),
          DecisionEvaluator: () => ({
            scoringPolicy: {
              questions: [
                {
                  __typename: "DecisionPredicateScoring",
                  name: "helpful",
                  optimizationDirection: "MAXIMIZE",
                  threshold: 0.7,
                },
                {
                  __typename: "DecisionChoiceScoring",
                  name: "tone",
                  optimizationDirection: "NONE",
                  scores: [
                    { choice: "warm", score: 1 },
                    { choice: "curt", score: 0 },
                  ],
                },
              ],
            },
          }),
          DecisionVersion: () => ({
            id: "version-1",
            decisionId: "decision-1",
            decision: { name: "answer-quality" },
            modelName: "jev-latest",
            modelProvider: "OPENAI",
            templateFormat: "MUSTACHE",
            state: {
              __typename: "DecisionTextState",
              text: "Answer: {{answer}}",
            },
            questions: [
              {
                __typename: "DecisionPredicateQuestion",
                name: "helpful",
                instructions: "Does the answer help the user?",
                criteria: {
                  true: "Resolves the request",
                  false: "Leaves the request open",
                },
              },
              {
                __typename: "DecisionChoiceQuestion",
                name: "tone",
                instructions: "What is the tone of the answer?",
                choices: [
                  { value: "warm", description: "Friendly and patient" },
                  { value: "curt", description: null },
                ],
              },
            ],
          }),
        })
      );
    });

    const text = container.textContent ?? "";
    expect(text).toContain("answer-quality");
    expect(
      container.querySelector(
        "a[href='/prompts/decisions/decision-1/versions/version-1']"
      )
    ).not.toBeNull();
    expect(text).toContain("jev-latest");
    expect(text).toContain("Answer: {{answer}}");
    expect(
      container.querySelectorAll("[data-testid='decision-question']")
    ).toHaveLength(2);
    expect(text).toContain("Does the answer help the user?");
    expect(text).toContain("Resolves the request");
    expect(text).toContain("Leaves the request open");
    expect(text).toContain("Friendly and patient");
    expect(text).toContain("Yes / No: true at probability >= 0.7");
    expect(text).toContain("Choice: warm = 1, curt = 0");
    expect(text).toContain("attributes.output.value");
  });
});
