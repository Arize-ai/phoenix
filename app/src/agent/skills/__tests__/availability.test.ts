import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import { buildAvailableAgentSkillsInput } from "@phoenix/agent/skills/availability";

describe("buildAvailableAgentSkillsInput", () => {
  it("projects active contexts into skill availability flags", () => {
    const contexts: AgentContext[] = [
      {
        type: "app",
        currentDateTime: "2026-06-08T12:00:00-07:00",
        timeZone: "UTC",
      },
      { type: "playground" },
      { type: "dataset", datasetNodeId: "dataset-id" },
    ];

    expect(buildAvailableAgentSkillsInput(contexts)).toEqual({
      hasPlaygroundContext: true,
      hasDatasetContext: true,
      hasLlmEvaluatorContext: false,
    });
  });

  it("reports evaluator authoring context availability", () => {
    expect(
      buildAvailableAgentSkillsInput([
        { type: "llm_evaluator", evaluatorNodeId: "id" },
      ])
    ).toEqual({
      hasPlaygroundContext: false,
      hasDatasetContext: false,
      hasLlmEvaluatorContext: true,
    });
  });
});
