import type { ProjectEvaluatorsTable_row$data } from "@phoenix/pages/project/evaluators/__generated__/ProjectEvaluatorsTable_row.graphql";

export const MOCK_PROJECT_EVALUATOR_ROWS: ProjectEvaluatorsTable_row$data[] = [
  {
    id: "UHJvamVjdEV2YWx1YXRvcjox",
    name: "hallucination-detector",
    evaluationTarget: "SPAN",
    samplingRate: 1,
    filterCondition: "span_kind == 'LLM'",
    updatedAt: "2026-07-18T14:32:00.000Z",
    evaluator: {
      id: "RXZhbHVhdG9yOjE=",
      kind: "LLM",
      prompt: {
        id: "UHJvbXB0OjE=",
        name: "hallucination-detector",
      },
      promptVersionTag: {
        name: "production",
      },
      promptVersion: {
        modelName: "gpt-4o-mini",
        modelProvider: "OPENAI",
      },
    },
    " $fragmentType": "ProjectEvaluatorsTable_row",
  },
  {
    id: "UHJvamVjdEV2YWx1YXRvcjoy",
    name: "response-toxicity",
    evaluationTarget: "TRACE",
    samplingRate: 0.25,
    filterCondition: "",
    updatedAt: "2026-07-17T09:15:00.000Z",
    evaluator: {
      id: "RXZhbHVhdG9yOjI=",
      kind: "LLM",
      prompt: {
        id: "UHJvbXB0OjI=",
        name: "response-toxicity",
      },
      promptVersionTag: null,
      promptVersion: {
        modelName: "claude-sonnet-4-20250514",
        modelProvider: "ANTHROPIC",
      },
    },
    " $fragmentType": "ProjectEvaluatorsTable_row",
  },
  {
    id: "UHJvamVjdEV2YWx1YXRvcjoz",
    name: "session-resolution",
    evaluationTarget: "SESSION",
    samplingRate: 1,
    filterCondition: "session_id is not null",
    updatedAt: "2026-07-16T20:08:00.000Z",
    evaluator: {
      id: "RXZhbHVhdG9yOjM=",
      kind: "CODE",
    },
    " $fragmentType": "ProjectEvaluatorsTable_row",
  },
  {
    id: "UHJvamVjdEV2YWx1YXRvcjo0",
    name: "contains-required-phrase",
    evaluationTarget: "SPAN",
    samplingRate: 0.5,
    filterCondition: "span_kind == 'LLM'",
    updatedAt: "2026-07-15T16:45:00.000Z",
    evaluator: {
      id: "RXZhbHVhdG9yOjQ=",
      kind: "BUILTIN",
    },
    " $fragmentType": "ProjectEvaluatorsTable_row",
  },
];
