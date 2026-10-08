import {
  buildDecisionInput,
  createDecisionDraft,
  getDecisionValidationError,
} from "../decisionUtils";

describe("decision input", () => {
  it("builds a valid Choice example", () => {
    const draft = createDecisionDraft();
    expect(getDecisionValidationError(draft)).toBeNull();
    expect(buildDecisionInput(draft).questions.department.type).toBe("choice");
  });
  it("preserves structured state rather than turning it into a chat message", () => {
    const draft = {
      ...createDecisionDraft(),
      stateFormat: "json" as const,
      state: '{"events":["refund"]}',
    };
    expect(buildDecisionInput(draft).state).toEqual({ events: ["refund"] });
  });
  it("rejects malformed state JSON", () => {
    expect(
      getDecisionValidationError({
        ...createDecisionDraft(),
        stateFormat: "json",
        state: "{",
      })
    ).not.toBeNull();
  });
  it.each(["", "   "])("rejects empty state %j", (state) => {
    expect(
      getDecisionValidationError({ ...createDecisionDraft(), state })
    ).not.toBeNull();
  });
  it("rejects duplicated question names before they overwrite each other", () => {
    const draft = createDecisionDraft();
    draft.questions.push({ ...draft.questions[0], id: "duplicate" });
    expect(getDecisionValidationError(draft)).toContain("duplicated");
  });
  it("supports all primitives and optional Noul criteria", () => {
    const draft = createDecisionDraft();
    draft.questions.push({
      id: "noul",
      name: "urgent",
      type: "noul",
      instructions: "Urgent?",
      criteria: "",
    });
    draft.questions.push({
      id: "score",
      name: "severity",
      type: "score",
      instructions: "Severity?",
      criteria: '["Low","High"]',
    });
    const input = buildDecisionInput(draft);
    expect(input.questions.urgent).toEqual({
      type: "noul",
      instructions: "Urgent?",
    });
    expect(input.questions.severity.criteria).toEqual(["Low", "High"]);
  });
  it("handles question names that overlap Object.prototype safely", () => {
    const draft = createDecisionDraft();
    draft.questions[0].name = "__proto__";
    expect(
      Object.hasOwn(buildDecisionInput(draft).questions, "__proto__")
    ).toBe(true);
  });
  it.each(['{"only":null}', "[]", '"invalid"'])(
    "rejects invalid Choice criteria %s",
    (criteria) => {
      const draft = createDecisionDraft();
      draft.questions[0].criteria = criteria;
      expect(getDecisionValidationError(draft)).not.toBeNull();
    }
  );
  it("retains explicitly undescribed Choice options", () => {
    const draft = createDecisionDraft();
    draft.questions[0].criteria = '{"yes":null,"no":null}';
    expect(buildDecisionInput(draft).questions.department.criteria).toEqual({
      yes: null,
      no: null,
    });
  });
  it("rejects empty questions, names and instructions", () => {
    const draft = createDecisionDraft();
    expect(getDecisionValidationError({ ...draft, questions: [] })).toContain(
      "at least one"
    );
    draft.questions[0].name = " ";
    expect(getDecisionValidationError(draft)).toContain("names");
    draft.questions[0].name = "valid";
    draft.questions[0].instructions = " ";
    expect(getDecisionValidationError(draft)).toContain("Instructions");
  });
});
