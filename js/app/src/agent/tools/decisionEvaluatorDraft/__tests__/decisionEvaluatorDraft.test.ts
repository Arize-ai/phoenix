import {
  applyDecisionDraftOperations,
  createEditDecisionEvaluatorDraftClientAction,
  type DecisionEvaluatorDraftHost,
  editDecisionEvaluatorDraftInputSchema,
} from "@phoenix/agent/tools/decisionEvaluatorDraft";
import {
  grantScriptApproval,
  revokeScriptApproval,
} from "@phoenix/agent/uiOperations/scriptApprovalGrant";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import {
  createDecisionQuestion,
  createDecisionStateDraft,
} from "@phoenix/pages/playground/decisionUtils";
import type { DecisionPromptDraft } from "@phoenix/store/playground";

const PROMPT: DecisionPromptDraft = {
  state: createDecisionStateDraft({
    text: "Request:\n{{input}}\n\nResponse:\n{{output}}",
  }),
  questions: [
    createDecisionQuestion({
      type: "predicate",
      name: "relevant",
      instructions: "Does the response address the request?",
    }),
  ],
};

const BASE = {
  name: "",
  prompt: PROMPT,
  scoringPolicy: null,
  inputMapping: { pathMapping: {}, literalMapping: {} },
  templateFormat: TemplateFormats.Mustache,
};

describe("applyDecisionDraftOperations", () => {
  it("sets the name, state, and questions", () => {
    const result = applyDecisionDraftOperations({
      ...BASE,
      operations: [
        { type: "set_name", name: " resolved-decision " },
        { type: "set_state", template: "Conversation:\n{{input}}" },
        {
          type: "set_questions",
          questions: [
            {
              name: "resolved",
              type: "predicate",
              instructions: "Does the reply resolve the request?",
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe("resolved-decision");
    expect(result.prompt.state.text).toBe("Conversation:\n{{input}}");
    expect(result.prompt.questions).toHaveLength(1);
    expect(result.prompt.questions[0]).toMatchObject({
      name: "resolved",
      type: "predicate",
    });
  });

  it("keeps the id of a question whose name is unchanged", () => {
    const result = applyDecisionDraftOperations({
      ...BASE,
      operations: [
        {
          type: "set_questions",
          questions: [
            {
              name: "relevant",
              type: "predicate",
              instructions: "Is the response on topic?",
            },
          ],
        },
      ],
    });
    expect(result.ok && result.prompt.questions[0].id).toBe(
      PROMPT.questions[0].id
    );
  });

  it("builds choice options from values", () => {
    const result = applyDecisionDraftOperations({
      ...BASE,
      operations: [
        {
          type: "set_questions",
          questions: [
            {
              name: "outcome",
              type: "choice",
              instructions: "How did the conversation end?",
              choices: [{ value: "resolved" }, { value: "unresolved" }],
            },
          ],
        },
      ],
    });
    expect(
      result.ok && result.prompt.questions[0].choices.map(({ value }) => value)
    ).toEqual(["resolved", "unresolved"]);
  });

  it("refuses an edit that leaves the decision invalid, with reasons", () => {
    const result = applyDecisionDraftOperations({
      ...BASE,
      operations: [
        {
          type: "set_questions",
          questions: [
            {
              name: "outcome",
              type: "choice",
              instructions: "Pick",
              choices: [],
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("outcome.choices");
  });

  it("refuses a scoring policy for a question the draft lacks", () => {
    const result = applyDecisionDraftOperations({
      ...BASE,
      operations: [
        {
          type: "set_scoring_policy",
          scoringPolicy: {
            questions: [
              {
                predicate: {
                  name: "missing",
                  threshold: 0.5,
                  optimizationDirection: "MAXIMIZE",
                },
              },
            ],
          },
        },
      ],
    });
    expect(!result.ok && result.error).toContain("missing");
  });

  it("merges a partial input mapping", () => {
    const result = applyDecisionDraftOperations({
      ...BASE,
      inputMapping: { pathMapping: { output: "output" }, literalMapping: {} },
      operations: [
        {
          type: "set_input_mapping",
          inputMapping: { literalMapping: { tone: "formal" } },
        },
      ],
    });
    expect(result.ok && result.inputMapping).toEqual({
      pathMapping: { output: "output" },
      literalMapping: { tone: "formal" },
    });
  });
});

describe("editDecisionEvaluatorDraftInputSchema", () => {
  it("rejects an unknown operation type", () => {
    expect(
      editDecisionEvaluatorDraftInputSchema.safeParse({
        operations: [{ type: "set_model", model: "gpt-4o" }],
      }).success
    ).toBe(false);
  });
});

describe("decision draft edit client action", () => {
  const CALL_ID = "decision-call";
  beforeEach(() => grantScriptApproval(CALL_ID));
  afterEach(() => revokeScriptApproval(CALL_ID));

  it("returns the host's refusal without applying anything", async () => {
    const host: DecisionEvaluatorDraftHost = {
      getSnapshot: vi.fn(),
      applyOperations: vi.fn(() => ({
        ok: false as const,
        error: "The decision version is still loading",
      })),
      submit: vi.fn(),
    };
    const edit = createEditDecisionEvaluatorDraftClientAction({
      getDraftHost: () => host,
    });
    const result = await edit(
      { operations: [{ type: "set_name", name: "x" }] },
      { callId: `${CALL_ID}:1`, sessionId: "s" }
    );
    expect(result).toEqual({
      ok: false,
      error: "The decision version is still loading",
    });
  });
});
