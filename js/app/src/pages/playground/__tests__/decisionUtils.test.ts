import { TemplateFormats } from "@phoenix/components/templateEditor/constants";

import {
  buildDecisionRequest,
  createChoiceOption,
  createDecisionDraft,
  createDecisionQuestion,
  createScoreLevel,
  extractDecisionVariables,
  getDecisionValidationError,
  normalizeDecisionResult,
  parseDecisionImport,
  toOpenAIDecisionsBody,
  toProviderBody,
  toSystemOneBody,
  validateDecisionDraft,
} from "../decisionUtils";

describe("decision request draft", () => {
  it("builds a valid Choice example", () => {
    const draft = createDecisionDraft();
    expect(getDecisionValidationError(draft)).toBeNull();
    const request = buildDecisionRequest({ draft });
    expect(request.questions.department).toEqual({
      type: "choice",
      instructions: "Which department should handle this request?",
      criteria: {
        billing: "Payments, invoices, and refunds",
        technical: "Problems using the product",
        other: "Requests outside these categories",
      },
    });
  });

  it("preserves structured state rather than turning it into a chat message", () => {
    const draft = {
      ...createDecisionDraft(),
      stateFormat: "json" as const,
      state: '{"events":["refund"]}',
    };
    expect(buildDecisionRequest({ draft }).state).toEqual({
      events: ["refund"],
    });
  });

  it("reports field-level errors instead of one banner", () => {
    const draft = createDecisionDraft();
    draft.state = "   ";
    draft.questions[0].name = "";
    draft.questions[0].choices[1].value = "billing";
    const errors = validateDecisionDraft(draft);
    expect(errors.state).toBe("State cannot be empty");
    const questionErrors = errors.byQuestionId[draft.questions[0].id];
    expect(questionErrors?.name).toBe("Required");
    expect(
      questionErrors?.choiceOptions?.[draft.questions[0].choices[1].id]
    ).toBe("Duplicate");
  });

  it("rejects malformed JSON state, empty questions, and duplicate names", () => {
    const base = createDecisionDraft();
    expect(
      getDecisionValidationError({ ...base, stateFormat: "json", state: "{" })
    ).toContain("valid JSON");
    expect(getDecisionValidationError({ ...base, questions: [] })).toContain(
      "at least one"
    );
    const duplicated = createDecisionDraft();
    duplicated.questions.push({ ...duplicated.questions[0], id: "duplicate" });
    expect(getDecisionValidationError(duplicated)).toContain("duplicated");
  });

  it("supports all primitives and omits empty Noul criteria", () => {
    const draft = createDecisionDraft();
    draft.questions.push(
      createDecisionQuestion({
        type: "noul",
        name: "urgent",
        instructions: "Urgent?",
      })
    );
    draft.questions.push(
      createDecisionQuestion({
        type: "score",
        name: "severity",
        instructions: "Severity?",
        levels: [createScoreLevel("Low"), createScoreLevel("High")],
      })
    );
    const request = buildDecisionRequest({ draft });
    expect(request.questions.urgent).toEqual({
      type: "noul",
      instructions: "Urgent?",
    });
    expect(request.questions.severity).toEqual({
      type: "score",
      instructions: "Severity?",
      criteria: ["Low", "High"],
    });
  });

  it("keeps undescribed Choice options as null criteria", () => {
    const draft = createDecisionDraft();
    draft.questions[0].choices = [
      createChoiceOption({ value: "yes" }),
      createChoiceOption({ value: "no" }),
    ];
    expect(
      buildDecisionRequest({ draft }).questions.department.criteria
    ).toEqual({
      yes: null,
      no: null,
    });
  });

  it("handles question names that overlap Object.prototype safely", () => {
    const draft = createDecisionDraft();
    draft.questions[0].name = "__proto__";
    expect(
      Object.hasOwn(buildDecisionRequest({ draft }).questions, "__proto__")
    ).toBe(true);
  });
});

describe("template variables", () => {
  it("extracts variables from state, instructions, and criteria", () => {
    const draft = createDecisionDraft();
    draft.state = "Ticket: {{ticket}}";
    draft.questions[0].instructions = "Route for {{team}}";
    draft.questions[0].choices[0].description = "Owned by {{owner}}";
    expect(
      extractDecisionVariables({
        draft,
        templateFormat: TemplateFormats.Mustache,
      }).sort()
    ).toEqual(["owner", "team", "ticket"]);
    expect(
      extractDecisionVariables({ draft, templateFormat: TemplateFormats.NONE })
    ).toEqual([]);
  });

  it("applies variables when building the request, including inside JSON state", () => {
    const draft = createDecisionDraft();
    draft.stateFormat = "json";
    draft.state = '{"ticket": "{{ticket}}"}';
    draft.questions[0].instructions = "Route {{ticket}}";
    const request = buildDecisionRequest({
      draft,
      templateFormat: TemplateFormats.Mustache,
      variables: { ticket: "T-1" },
    });
    expect(request.state).toEqual({ ticket: "T-1" });
    expect(request.questions.department.instructions).toBe("Route T-1");
  });
});

describe("provider wire formats", () => {
  const draft = (() => {
    const base = createDecisionDraft();
    base.questions.push(
      createDecisionQuestion({
        type: "noul",
        name: "urgent",
        instructions: "Urgent?",
        noul: { trueDescription: "Time sensitive", falseDescription: "" },
      })
    );
    base.questions.push(
      createDecisionQuestion({
        type: "score",
        name: "severity",
        instructions: "Severity?",
        levels: [createScoreLevel("Low"), createScoreLevel("High")],
      })
    );
    return base;
  })();

  it("exports the System One body with the model", () => {
    const body = toSystemOneBody({
      request: buildDecisionRequest({ draft }),
      model: "jev-latest",
    });
    expect(body.model).toBe("jev-latest");
    expect(body.questions.urgent).toEqual({
      type: "noul",
      instructions: "Urgent?",
      criteria: { true: "Time sensitive" },
    });
  });

  it("exports the OpenAI Decisions body the same way the server converts it", () => {
    const body = toOpenAIDecisionsBody({
      request: buildDecisionRequest({ draft }),
      model: "gpt-6-luna",
    });
    expect(body.model).toBe("gpt-6-luna");
    expect(body.input).toBe(draft.state);
    expect(body.questions[0]).toMatchObject({
      type: "choice",
      name: "department",
      choices: [
        { value: "billing", description: "Payments, invoices, and refunds" },
        { value: "technical", description: "Problems using the product" },
        { value: "other", description: "Requests outside these categories" },
      ],
    });
    expect(body.questions[1]).toEqual({
      type: "predicate",
      name: "urgent",
      instructions: 'Urgent?\nCriteria: {"true":"Time sensitive"}',
    });
    expect(body.questions[2]).toEqual({
      type: "score",
      name: "severity",
      instructions: "Severity?",
      levels: [
        { label: "0", description: "Low" },
        { label: "1", description: "High" },
      ],
    });
  });

  it("picks the body shape from the wire format the server reports", () => {
    const request = buildDecisionRequest({ draft });
    expect(
      toProviderBody({ request, wireFormat: "SYSTEM_ONE", model: "m" })
    ).toHaveProperty("state");
    expect(
      toProviderBody({ request, wireFormat: "OPENAI_DECISIONS", model: "m" })
    ).toHaveProperty("input");
  });

  it("imports a System One body and round-trips it", () => {
    const original = toSystemOneBody({
      request: buildDecisionRequest({ draft }),
      model: "jev-latest",
    });
    const imported = parseDecisionImport(JSON.stringify(original));
    expect(imported.format).toBe("SYSTEM_ONE");
    expect(imported.model).toBe("jev-latest");
    expect(getDecisionValidationError(imported.draft)).toBeNull();
    const { model: _roundTrippedModel, ...roundTripped } = toSystemOneBody({
      request: buildDecisionRequest({ draft: imported.draft }),
      model: null,
    });
    const { model: _originalModel, ...expected } = original;
    expect(roundTripped).toEqual(expected);
  });

  it("imports an OpenAI Decisions body", () => {
    const imported = parseDecisionImport(
      JSON.stringify({
        model: "gpt-6-luna",
        input: "I was charged twice.",
        questions: [
          {
            type: "choice",
            name: "department",
            instructions: "Which team?",
            choices: [
              { value: "billing", description: "Refunds" },
              { value: "other" },
            ],
          },
          { type: "predicate", name: "urgent", instructions: "Urgent?" },
          {
            type: "score",
            name: "severity",
            instructions: "How bad?",
            levels: [
              { label: "low" },
              { label: "high", description: "Outage" },
            ],
          },
        ],
      })
    );
    expect(imported.format).toBe("OPENAI_DECISIONS");
    expect(imported.draft.stateFormat).toBe("text");
    const request = buildDecisionRequest({ draft: imported.draft });
    expect(request.questions.department).toEqual({
      type: "choice",
      instructions: "Which team?",
      criteria: { billing: "Refunds", other: null },
    });
    expect(request.questions.urgent.type).toBe("noul");
    expect(request.questions.severity).toEqual({
      type: "score",
      instructions: "How bad?",
      criteria: ["low", "Outage"],
    });
  });

  it("imports structured JSON state as JSON", () => {
    const imported = parseDecisionImport(
      JSON.stringify({
        state: { events: ["refund"] },
        questions: { urgent: { type: "noul", instructions: "Urgent?" } },
      })
    );
    expect(imported.draft.stateFormat).toBe("json");
    expect(JSON.parse(imported.draft.state)).toEqual({ events: ["refund"] });
  });

  it.each([
    "not json",
    "[]",
    '{"state": "x"}',
    '{"input": "x", "questions": [{"type": "chat"}]}',
  ])("rejects %s with a readable error", (text) => {
    expect(() => parseDecisionImport(text)).toThrow();
  });
});

describe("answer normalization", () => {
  it("normalizes a System One response in the author's option order", () => {
    const draft = createDecisionDraft();
    const result = normalizeDecisionResult({
      result: {
        model: "jev-1.13.0",
        answers: {
          department: {
            type: "choice",
            choice: "billing",
            confidence: 0.9,
            probabilities: { other: 0.05, billing: 0.9, technical: 0.05 },
          },
        },
        usage: { input_tokens: 345, output_tokens: 38 },
      },
      draft,
    });
    expect(result.model).toBe("jev-1.13.0");
    expect(result.usage).toEqual({ input: 345, output: 38 });
    const answer = result.answers[0];
    expect(answer.kind).toBe("choice");
    if (answer.kind === "choice") {
      expect(answer.probabilities.map((entry) => entry.value)).toEqual([
        "billing",
        "technical",
        "other",
      ]);
      expect(answer.choice).toBe("billing");
      expect(answer.confidence).toBe(0.9);
    }
  });

  it("normalizes OpenAI predicate, score, and refusal answers", () => {
    const draft = createDecisionDraft();
    draft.questions = [
      createDecisionQuestion({
        type: "noul",
        name: "urgent",
        instructions: "?",
      }),
      createDecisionQuestion({
        type: "score",
        name: "severity",
        instructions: "?",
        levels: [createScoreLevel("Low"), createScoreLevel("High")],
      }),
      createDecisionQuestion({
        type: "noul",
        name: "blocked",
        instructions: "?",
      }),
    ];
    const result = normalizeDecisionResult({
      result: {
        answers: {
          urgent: { type: "predicate", probability: 0.2 },
          severity: {
            type: "score",
            score: 0.7,
            confidence: 0.6,
            probabilities: [
              { value: 0, label: "0", probability: 0.3 },
              { value: 1, label: "1", probability: 0.7 },
            ],
          },
          blocked: { type: "refusal", name: "blocked" },
        },
      },
      draft,
    });
    expect(result.answers.map((answer) => answer.kind)).toEqual([
      "noul",
      "score",
      "refusal",
    ]);
    const score = result.answers[1];
    if (score.kind === "score") {
      expect(score.levels.map((level) => level.label)).toEqual(["0", "1"]);
      expect(score.score).toBe(0.7);
    }
  });
});
