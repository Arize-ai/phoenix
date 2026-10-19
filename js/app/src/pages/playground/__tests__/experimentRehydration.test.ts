import { decisionTaskConfigToPlaygroundProps } from "../experimentRehydration";

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
  questionsPath: null,
  questionsFormat: "PHOENIX",
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
    task: { member: "decision" },
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
    templateVariablesPathByRole: { tested: "metadata.inputs" },
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
