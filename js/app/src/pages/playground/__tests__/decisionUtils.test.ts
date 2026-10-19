import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { DEFAULT_INSTANCE_PARAMS } from "@phoenix/store/playground";
import type { PlaygroundInstance } from "@phoenix/store/playground/types";

import {
  buildChatFromDecisionDraft,
  buildDecisionInstanceFromSpanAttributes,
  buildDecisionConnection,
  buildDecisionInput,
  buildDecisionTaskDefinition,
  buildDecisionRequest,
  createChoiceOption,
  createDecisionDraft,
  createDecisionQuestion,
  createScoreLevel,
  decisionFieldId,
  extractDecisionVariables,
  getDecisionDatasetBlockedReason,
  getDecisionDatasetProblem,
  getDecisionValidationError,
  maskUntouchedErrors,
  normalizeDecisionAnswer,
  normalizeDecisionResult,
  parseDecisionImport,
  toDecisionJsonSchema,
  toDecisionOutput,
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

  it("reports an empty level per level", () => {
    const draft = createDecisionDraft();
    const score = createDecisionQuestion({
      type: "score",
      name: "severity",
      instructions: "Severity?",
      levels: [createScoreLevel("Low"), createScoreLevel("")],
    });
    draft.questions.push(score);
    const errors = validateDecisionDraft(draft);
    expect(errors.byQuestionId[score.id]).toEqual({
      levelDescriptions: { [score.levels[1].id]: "Required" },
    });
    expect(getDecisionValidationError(draft)).toBe(
      "severity: every level needs a description"
    );
  });

  it("holds back empty required fields until the user has left them", () => {
    const draft = createDecisionDraft();
    draft.state = "";
    draft.questions[0].name = "";
    draft.questions[0].instructions = "";
    const [choice] = draft.questions;
    choice.choices[0].value = "";
    const errors = validateDecisionDraft(draft);
    const untouched = maskUntouchedErrors({ errors, touched: new Set() });
    expect(untouched.state).toBeUndefined();
    expect(untouched.byQuestionId[choice.id]).toBeUndefined();
    const visited = maskUntouchedErrors({
      errors,
      touched: new Set([
        decisionFieldId.state(),
        decisionFieldId.name(choice.id),
        decisionFieldId.option(choice.choices[0].id),
      ]),
    });
    expect(visited.state).toBe("State cannot be empty");
    expect(visited.byQuestionId[choice.id]).toEqual({
      name: "Required",
      choiceOptions: { [choice.choices[0].id]: "Required" },
    });
    // Run still refuses the request while anything is hidden.
    expect(getDecisionValidationError(draft)).not.toBeNull();
  });

  it("shows duplicate and count errors without waiting", () => {
    const draft = createDecisionDraft();
    const [choice] = draft.questions;
    choice.choices[1].value = "billing";
    draft.questions.push({ ...choice, id: "copy" });
    const masked = maskUntouchedErrors({
      errors: validateDecisionDraft(draft),
      touched: new Set(),
    });
    expect(masked.byQuestionId.copy?.name).toBe("Duplicate name");
    expect(masked.byQuestionId[choice.id]?.choiceOptions).toEqual({
      [choice.choices[1].id]: "Duplicate",
    });
    expect(
      maskUntouchedErrors({
        errors: validateDecisionDraft({ ...draft, questions: [] }),
        touched: new Set(),
      }).questions
    ).toBe("Add at least one question");
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

  it("caps the question count like the server does", () => {
    const draft = createDecisionDraft();
    draft.questions = Array.from({ length: 256 }, (_, index) =>
      createDecisionQuestion({
        type: "noul",
        name: `q${index}`,
        instructions: "?",
      })
    );
    expect(getDecisionValidationError(draft)).toBe("At most 255 questions");
  });

  it("explains a JSON state that stops parsing once variables are filled in", () => {
    const draft = createDecisionDraft();
    draft.stateFormat = "json";
    draft.state = '{"note": "{{note}}"}';
    expect(() =>
      buildDecisionRequest({
        draft,
        templateFormat: TemplateFormats.Mustache,
        variables: { note: 'say "hi"' },
      })
    ).toThrow("not valid JSON after filling in variables");
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

describe("request import", () => {
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

  it("imports a System One body and round-trips it", () => {
    const original = buildDecisionRequest({ draft });
    const imported = parseDecisionImport(
      JSON.stringify({ model: "jev-latest", ...original })
    );
    expect(imported.model).toBe("jev-latest");
    expect(getDecisionValidationError(imported.draft)).toBeNull();
    expect(buildDecisionRequest({ draft: imported.draft })).toEqual(original);
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

  it("names the field a schema error refers to", () => {
    expect(() =>
      parseDecisionImport(
        '{"state": "x", "questions": {"q": {"type": "choice", "criteria": {"a": "b", "c": "d"}}}}'
      )
    ).toThrow("questions.q.instructions");
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

describe("span replay", () => {
  const base = {
    ...DEFAULT_INSTANCE_PARAMS(),
    id: 1,
    template: { __type: "chat", messages: [] },
    selectedRepetitionNumber: 1,
  } as PlaygroundInstance;

  it("reads OpenAI's answer list by each answer's name", () => {
    const result = normalizeDecisionResult({
      result: {
        model: "gpt-decision",
        answers: [
          { name: "urgent", type: "predicate", probability: 0.9 },
          { name: "team", type: "refusal" },
        ],
      },
    });
    expect(result.answers).toEqual([
      { kind: "noul", name: "urgent", probability: 0.9 },
      { kind: "refusal", name: "team" },
    ]);
  });

  it("replays a custom provider's span on the built-in provider of its SDK", () => {
    const { playgroundInstance, parsingErrors } =
      buildDecisionInstanceFromSpanAttributes({
        base,
        spanId: "span",
        attributes: {
          openinference: { span: { kind: "DECISION" } },
          decision: {
            system: "openai",
            provider: "openrouter",
            request: { model_name: "gpt-decision" },
          },
        },
      });
    expect(playgroundInstance.model.provider).toBe("OPENAI");
    expect(parsingErrors.join("\n")).toContain(
      'ran on the custom provider "openrouter"'
    );
    expect(parsingErrors.join("\n")).not.toContain(
      "Could not determine the decision provider"
    );
  });
});

describe("structured output", () => {
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

  it("maps each question type to a schema an LLM can fill", () => {
    const schema = toDecisionJsonSchema(draft.questions);
    expect(schema).toMatchObject({
      type: "object",
      required: ["department", "urgent", "severity"],
      additionalProperties: false,
    });
    expect(schema.properties.department).toEqual({
      type: "string",
      enum: ["billing", "technical", "other"],
      description:
        "Which department should handle this request?\n" +
        "- billing: Payments, invoices, and refunds\n" +
        "- technical: Problems using the product\n" +
        "- other: Requests outside these categories",
    });
    expect(schema.properties.urgent).toEqual({
      type: "boolean",
      description: "Urgent?\nTrue when: Time sensitive",
    });
    expect(schema.properties.severity).toEqual({
      type: "integer",
      enum: [0, 1],
      description: "Severity?\n0: Low\n1: High",
    });
  });

  it("builds a chat template that asks an LLM the same questions", () => {
    const { messages, responseFormat } = buildChatFromDecisionDraft({
      draft,
      templateFormat: TemplateFormats.Mustache,
    });
    expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(messages[1].content).toBe(draft.state);
    expect(messages[0].content).toContain("## department");
    expect(messages[0].content).toContain(
      "- billing: Payments, invoices, and refunds"
    );
    expect(messages[0].content).toContain("Answer true or false.");
    expect(messages[0].content).toContain(
      "Answer with a level from 0 to 1, low to high:"
    );
    expect(responseFormat).toEqual({
      type: "json_schema",
      jsonSchema: {
        name: "decision",
        strict: true,
        schema: toDecisionJsonSchema(draft.questions),
      },
    });
  });

  it("writes listed inputs as one variable per line in the chat", () => {
    const draft = {
      ...createDecisionDraft(),
      stateFormat: "inputs" as const,
      state: "reference, output",
    };
    expect(
      buildChatFromDecisionDraft({
        draft,
        templateFormat: TemplateFormats.FString,
      }).messages[1].content
    ).toBe("reference: {reference}\noutput: {output}");
  });
});

describe("runDecision input", () => {
  it("sends plain text state whole, through one input", () => {
    const input = buildDecisionInput({ draft: createDecisionDraft() });
    expect(input.inputs).toEqual([{ name: "state" }]);
    expect(input.state).toEqual({
      text: { template: "{{state}}", templateFormat: "MUSTACHE" },
    });
    expect(input.inputValues).toEqual({
      state:
        "I was charged twice for my order. Please refund the duplicate payment.",
    });
  });

  it("lets the server render a text state over its template variables", () => {
    const draft = {
      ...createDecisionDraft(),
      state: "Plan: {{plan}}\nTicket: {{ticket}}",
    };
    const input = buildDecisionInput({
      draft,
      templateFormat: TemplateFormats.Mustache,
      variables: { plan: "pro" },
    });
    expect(input.inputs).toEqual([{ name: "plan" }, { name: "ticket" }]);
    expect(input.state).toEqual({
      text: { template: draft.state, templateFormat: "MUSTACHE" },
    });
    // Every declared input needs a value; an unset variable is sent empty.
    expect(input.inputValues).toEqual({ plan: "pro", ticket: "" });
  });

  it("sends a JSON object as an object state, one input per key", () => {
    const draft = {
      ...createDecisionDraft(),
      stateFormat: "json" as const,
      state: '{"plan":"pro","events":["refund"]}',
    };
    const input = buildDecisionInput({ draft });
    expect(input.inputs).toEqual([{ name: "plan" }, { name: "events" }]);
    expect(input.state).toEqual({ object: true });
    expect(input.inputValues).toEqual({ plan: "pro", events: ["refund"] });
  });

  it("sends listed inputs as an object state, valued from the variables", () => {
    const draft = {
      ...createDecisionDraft(),
      stateFormat: "inputs" as const,
      state: " reference ,output, ",
    };
    const input = buildDecisionInput({
      draft,
      templateFormat: TemplateFormats.Mustache,
      variables: { reference: "billing" },
    });
    expect(input.inputs).toEqual([{ name: "reference" }, { name: "output" }]);
    expect(input.state).toEqual({ object: true });
    expect(input.inputValues).toEqual({ reference: "billing", output: "" });
    expect(
      buildDecisionRequest({ draft, variables: { reference: "billing" } }).state
    ).toEqual({ reference: "billing", output: "" });
    expect(
      extractDecisionVariables({
        draft,
        templateFormat: TemplateFormats.Mustache,
      })
    ).toEqual(["reference", "output"]);
    expect(
      extractDecisionVariables({
        draft,
        templateFormat: TemplateFormats.NONE,
      })
    ).toEqual(["reference", "output"]);
  });

  it("runs listed inputs over a dataset as an object state", () => {
    const draft = {
      ...createDecisionDraft(),
      stateFormat: "inputs" as const,
      state: "reference, output",
    };
    expect(
      getDecisionDatasetProblem({
        draft,
        templateFormat: TemplateFormats.NONE,
      })
    ).toBeNull();
    expect(
      buildDecisionTaskDefinition({
        draft,
        templateFormat: TemplateFormats.Mustache,
      })
    ).toMatchObject({
      inputs: [{ name: "reference" }, { name: "output" }],
      state: { object: true },
    });
  });

  it("requires listed inputs to be named once each", () => {
    const draft = {
      ...createDecisionDraft(),
      stateFormat: "inputs" as const,
    };
    expect(validateDecisionDraft({ ...draft, state: " , " }).state).toBe(
      "State cannot be empty"
    );
    expect(validateDecisionDraft({ ...draft, state: "a, b, a" }).state).toBe(
      'Input "a" is listed twice'
    );
  });

  it("sends a JSON array whole", () => {
    const draft = {
      ...createDecisionDraft(),
      stateFormat: "json" as const,
      state: '["refund"]',
    };
    expect(buildDecisionInput({ draft }).inputValues).toEqual({
      state: ["refund"],
    });
  });

  it("builds one @oneOf input per question with formatted text", () => {
    const draft = createDecisionDraft();
    draft.questions = [
      createDecisionQuestion({
        type: "noul",
        name: "urgent",
        instructions: "Is {{who}} waiting?",
        noul: { trueDescription: "Time sensitive", falseDescription: "" },
      }),
      createDecisionQuestion({
        type: "score",
        name: "severity",
        instructions: "How severe?",
        levels: [createScoreLevel("Low"), createScoreLevel("High")],
      }),
    ];
    const input = buildDecisionInput({
      draft,
      templateFormat: TemplateFormats.Mustache,
      variables: { who: "the customer" },
    });
    expect(input.questions).toEqual([
      {
        predicate: {
          name: "urgent",
          instructions: "Is the customer waiting?",
          criteria: { true: "Time sensitive", false: null },
        },
      },
      {
        scale: {
          name: "severity",
          instructions: "How severe?",
          levels: [
            { label: "Low", description: null },
            { label: "High", description: null },
          ],
        },
      },
    ]);
  });
});

describe("runDecision output", () => {
  it("stores typed answers in the shape the result view reads", () => {
    const draft = createDecisionDraft();
    const output = toDecisionOutput({
      model: "jev-1.13.0",
      answers: [
        {
          __typename: "ChoiceAnswer",
          name: "department",
          choice: "billing",
          confidence: 0.8,
          choiceProbabilities: [
            { value: "billing", probability: 0.8 },
            { value: "technical", probability: 0.2 },
          ],
        },
        {
          __typename: "ScaleAnswer",
          name: "severity",
          expectedLevel: 0.4,
          confidence: 0.7,
          levelProbabilities: [
            { level: 0, probability: 0.6 },
            { level: 1, probability: 0.4 },
          ],
        },
        { __typename: "RefusalAnswer", name: "spam" },
      ],
      usage: { inputTokens: 12, outputTokens: 3 },
    });
    const normalized = normalizeDecisionResult({
      result: JSON.parse(JSON.stringify(output)),
      draft,
    });
    expect(normalized.model).toBe("jev-1.13.0");
    expect(normalized.usage).toEqual({ input: 12, output: 3 });
    expect(normalized.answers[0]).toMatchObject({
      kind: "choice",
      choice: "billing",
      confidence: 0.8,
    });
    expect(normalized.answers).toContainEqual(
      expect.objectContaining({ kind: "score", name: "severity", score: 0.4 })
    );
    expect(normalized.answers).toContainEqual({
      kind: "refusal",
      name: "spam",
    });
  });
});

describe("buildDecisionConnection", () => {
  const credentials = [{ envVarName: "TYPESAFE_API_KEY", value: "key" }];

  it("sends only the id of a custom provider, which brings its own key and endpoint", () => {
    expect(
      buildDecisionConnection({
        provider: "TYPESAFE",
        baseUrl: "http://ignored.example",
        customProvider: { id: "provider-1" },
        credentials,
      })
    ).toEqual({ customProvider: { id: "provider-1" } });
  });

  it("sends a built-in provider with its endpoint and credentials", () => {
    expect(
      buildDecisionConnection({
        provider: "OLLAMA",
        baseUrl: " http://localhost:11434 ",
        credentials: [],
      })
    ).toEqual({
      builtIn: {
        providerKey: "OLLAMA",
        baseUrl: "http://localhost:11434",
        credentials: [],
      },
    });
  });

  it("leaves a blank endpoint to the provider default", () => {
    expect(
      buildDecisionConnection({
        provider: "TYPESAFE",
        baseUrl: "  ",
        credentials,
      })
    ).toEqual({
      builtIn: { providerKey: "TYPESAFE", baseUrl: null, credentials },
    });
  });
});

describe("decision tasks over a dataset", () => {
  const mustache = TemplateFormats.Mustache;

  it("passes a state that is one variable through as that input", () => {
    const draft = { ...createDecisionDraft(), state: " {{state}} " };
    const definition = buildDecisionTaskDefinition({
      draft,
      templateFormat: mustache,
    });
    expect(definition.inputs).toEqual([{ name: "state" }]);
    expect(definition.state).toEqual({ input: "state" });
    expect(definition.questions[0]).toMatchObject({
      choice: { name: "department" },
    });
  });

  it("sends any other text state as a template over its variables", () => {
    const draft = {
      ...createDecisionDraft(),
      state: "Ticket: {{ticket}} (plan {{plan}})",
    };
    expect(
      buildDecisionTaskDefinition({ draft, templateFormat: mustache })
    ).toMatchObject({
      inputs: [{ name: "ticket" }, { name: "plan" }],
      state: {
        text: {
          template: "Ticket: {{ticket}} (plan {{plan}})",
          templateFormat: "MUSTACHE",
        },
      },
    });
  });

  it("deduplicates repeated f-string variables and extracts root input names from paths", () => {
    const draft = {
      ...createDecisionDraft(),
      state: "{ticket.subject}: {ticket[0]} ({topic} / {topic})",
    };
    expect(
      buildDecisionTaskDefinition({
        draft,
        templateFormat: TemplateFormats.FString,
      })
    ).toMatchObject({
      inputs: [{ name: "ticket" }, { name: "topic" }],
      state: {
        text: {
          template: "{ticket.subject}: {ticket[0]} ({topic} / {topic})",
          templateFormat: "F_STRING",
        },
      },
    });
    expect(
      buildDecisionInput({
        draft,
        templateFormat: TemplateFormats.FString,
        variables: { ticket: "Refund", topic: "billing" },
      })
    ).toMatchObject({
      inputs: [{ name: "ticket" }, { name: "topic" }],
      state: {
        text: {
          template: "{ticket.subject}: {ticket[0]} ({topic} / {topic})",
          templateFormat: "F_STRING",
        },
      },
      inputValues: { ticket: "Refund", topic: "billing" },
    });
    expect(
      extractDecisionVariables({
        draft,
        templateFormat: TemplateFormats.FString,
      })
    ).toEqual(["ticket", "topic"]);
  });

  it("explains what a dataset can't fill", () => {
    const draft = createDecisionDraft();
    expect(
      getDecisionDatasetProblem({ draft, templateFormat: mustache })
    ).toContain("needs a template variable");
    expect(
      getDecisionDatasetProblem({
        draft: { ...draft, state: "{{state}}", stateFormat: "json" },
        templateFormat: mustache,
      })
    ).toContain("write the state as text");
    const templatedQuestion = {
      ...draft,
      state: "{{state}}",
      questions: draft.questions.map((question) => ({
        ...question,
        instructions: "About {{customer}}?",
      })),
    };
    expect(
      getDecisionDatasetProblem({
        draft: templatedQuestion,
        templateFormat: mustache,
      })
    ).toContain("questions can't use template variables (customer)");
    expect(() =>
      buildDecisionTaskDefinition({
        draft: templatedQuestion,
        templateFormat: mustache,
      })
    ).toThrow("questions can't use template variables");
  });

  it("lets decisions and prompts share a dataset run, checking only the decisions", () => {
    const decision = {
      task: { member: "decision" },
      decisionRequest: { ...createDecisionDraft(), state: "{{state}}" },
    } as never;
    const unfillable = {
      task: { member: "decision" },
      decisionRequest: createDecisionDraft(),
    } as never;
    const prompt = {
      task: { member: "prompt" },
      decisionRequest: null,
    } as never;
    expect(
      getDecisionDatasetBlockedReason({
        instances: [decision],
        templateFormat: mustache,
      })
    ).toBeNull();
    expect(
      getDecisionDatasetBlockedReason({
        instances: [decision, prompt],
        templateFormat: mustache,
      })
    ).toBeNull();
    expect(
      getDecisionDatasetBlockedReason({
        instances: [prompt],
        templateFormat: mustache,
      })
    ).toBeNull();
    // The prompt before it still counts as instance A.
    expect(
      getDecisionDatasetBlockedReason({
        instances: [prompt, unfillable],
        templateFormat: mustache,
      })
    ).toMatch(/^Instance B: /);
  });
});

describe("normalizeDecisionAnswer for experiment run outputs", () => {
  it("reads a scale answer's expected level and level probabilities", () => {
    expect(
      normalizeDecisionAnswer({
        name: "urgency",
        answer: {
          type: "scale",
          expected_level: 1.3,
          confidence: 0.4,
          probabilities: { "0": 0.2, "1": 0.3, "2": 0.5 },
        },
      })
    ).toMatchObject({
      kind: "score",
      name: "urgency",
      score: 1.3,
      confidence: 0.4,
      levels: [
        { index: 0, probability: 0.2 },
        { index: 1, probability: 0.3 },
        { index: 2, probability: 0.5 },
      ],
    });
  });
});
