import type * as RelayRuntime from "relay-runtime";

const mockFetchQuery = vi.hoisted(() => vi.fn());

vi.mock("relay-runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof RelayRuntime>()),
  fetchQuery: (...args: unknown[]) => ({
    toPromise: () => mockFetchQuery(...args),
  }),
}));

import {
  decisionTaskConfigToPlaygroundProps,
  fetchExperimentPlaygroundProps,
} from "../experimentRehydration";

type DecisionTaskConfig = Parameters<
  typeof decisionTaskConfigToPlaygroundProps
>[0]["taskConfig"];

const taskConfig: DecisionTaskConfig = {
  __typename: "DecisionTaskConfig",
  modelProvider: "TYPESAFE",
  modelName: "jev-pinned",
  customProvider: { id: "provider-1", name: "My endpoint" },
  baseUrl: null,
  inputValuesPath: "metadata.inputs",
  inputs: [{ name: "ticket" }],
  state: { __typename: "DecisionObjectState", object: true },
  questions: [
    {
      __typename: "DecisionPredicateQuestion",
      name: "urgent",
      instructions: "Is the ticket urgent?",
      criteria: { true: "Requires attention today", false: "Can wait" },
    },
  ],
};

it("restores a decision's frozen definition, connection, and dataset settings", () => {
  const result = decisionTaskConfigToPlaygroundProps({
    taskConfig,
    maxConcurrency: 3,
    datasetId: "dataset-1",
    selectedDatasetEvaluatorIds: ["judge-1"],
  });
  expect(result.playgroundProps.instances?.[0]).toMatchObject({
    task: { type: "decision" },
    model: {
      provider: "TYPESAFE",
      modelName: "jev-pinned",
      customProvider: taskConfig.customProvider,
    },
    decisionRequest: {
      stateFormat: "inputs",
      state: "ticket",
      questions: [
        { type: "noul", name: "urgent", instructions: "Is the ticket urgent?" },
      ],
    },
  });
  expect(result.selectedDatasetEvaluatorIds).toEqual(["judge-1"]);
  expect(result.stateByDatasetId["dataset-1"]).toMatchObject({
    templateVariablesPathByMode: { task: "metadata.inputs" },
    maxConcurrency: 3,
  });
});

it("restores f-string text and a built-in provider's endpoint", () => {
  const result = decisionTaskConfigToPlaygroundProps({
    taskConfig: {
      ...taskConfig,
      customProvider: null,
      baseUrl: "http://localhost:11434/v1",
      state: {
        __typename: "DecisionTextState",
        template: "Ticket: {ticket}",
        templateFormat: "F_STRING",
      },
    },
    maxConcurrency: 1,
    datasetId: null,
    selectedDatasetEvaluatorIds: [],
  });
  expect(result.playgroundProps.templateFormat).toBe("F_STRING");
  expect(result.playgroundProps.instances?.[0]).toMatchObject({
    model: { baseUrl: "http://localhost:11434/v1", customProvider: null },
    decisionRequest: { stateFormat: "text", state: "Ticket: {ticket}" },
  });
  expect(result.stateByDatasetId).toEqual({});
});

it("fetches a fixed-question decision experiment", async () => {
  mockFetchQuery.mockResolvedValueOnce({
    node: {
      dataset: { id: "dataset-1" },
      job: {
        maxConcurrency: 2,
        datasetEvaluators: { edges: [{ node: { id: "judge-1" } }] },
        taskConfig: {
          ...taskConfig,
          state: { __typename: "DecisionInputState", input: "ticket" },
          questions: [
            {
              __typename: "DecisionChoiceQuestion",
              name: "team",
              instructions: "Which team?",
              choices: [
                { value: "billing", description: "Refunds" },
                { value: "other", description: null },
              ],
            },
            {
              __typename: "DecisionScaleQuestion",
              name: "severity",
              instructions: "Severity?",
              levels: [
                { label: "low", description: null },
                { label: "high", description: "Outage" },
              ],
            },
          ],
        },
      },
    },
  });
  const result = await fetchExperimentPlaygroundProps("exp-fixed");
  expect(result?.playgroundProps.instances?.[0]).toMatchObject({
    task: { type: "decision" },
    decisionRequest: {
      stateFormat: "text",
      state: "{{ticket}}",
      questions: [
        { type: "choice", name: "team", instructions: "Which team?" },
        { type: "score", name: "severity", instructions: "Severity?" },
      ],
    },
  });
});
