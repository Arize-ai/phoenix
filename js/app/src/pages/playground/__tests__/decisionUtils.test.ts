import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { DEFAULT_INSTANCE_PARAMS } from "@phoenix/store/playground";
import type { PlaygroundInstance } from "@phoenix/store/playground/types";

import {
  buildChatFromDecisionDraft,
  buildDecisionInstanceFromSpanAttributes,
  buildDecisionConnection,
  buildDecisionInput,
  buildDecisionTaskDefinition,
  buildSystemOneRequest,
  createChoiceOption,
  createDecisionDraft,
  createDecisionQuestion,
  createDecisionStateDraft,
  createScaleLevel,
  decisionFieldId,
  extractDecisionVariables,
  getDecisionDatasetBlockedReason,
  getDecisionDatasetProblem,
  getChatForDecisionToPrompt,
  getDecisionValidationError,
  inputNamesToTemplate,
  maskUntouchedErrors,
  normalizeDecisionAnswer,
  normalizeDecisionResult,
  parseDecisionImport,
  switchDecisionStateMode,
  toDecisionJsonSchema,
  toDecisionOutput,
  describeDecisionInputsState,
  getDecisionInputsStateShape,
  toInputValueText,
  toStructuredInputValue,
  validateDecisionDraft,
} from "../decisionUtils";

/** A template state. */
const templateState = (template: string) =>
  createDecisionStateDraft({ template });

/** An `inputs` state over these names, sent as an object. */
const inputsState = (...inputNames: string[]) =>
  createDecisionStateDraft({ mode: "inputs", inputNames });

/** An `inputs` state sending one input's value alone. */
const valueState = (inputName: string) =>
  createDecisionStateDraft({
    mode: "inputs",
    inputNames: [inputName],
    inputsShape: "value",
  });

describe("decision prompt draft", () => {
  it("builds a valid Choice example", () => {
    const draft = createDecisionDraft();
    expect(getDecisionValidationError(draft)).toBeNull();
    const request = buildSystemOneRequest({ draft });
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

  it("preserves structured input values rather than turning them into text", () => {
    const draft = { ...createDecisionDraft(), state: valueState("events") };
    expect(
      buildSystemOneRequest({
        draft,
        variables: { events: '["refund"]' },
      }).state
    ).toEqual(["refund"]);
    expect(
      buildSystemOneRequest({
        draft: { ...draft, state: inputsState("events") },
        variables: { events: '["refund"]' },
      }).state
    ).toEqual({ events: ["refund"] });
    expect(
      buildSystemOneRequest({
        draft: { ...draft, state: inputsState("events", "plan") },
        variables: { events: '["refund"]', plan: "pro" },
      }).state
    ).toEqual({ events: ["refund"], plan: "pro" });
  });

  it("reports field-level errors instead of one banner", () => {
    const draft = createDecisionDraft();
    draft.state = templateState("   ");
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
      type: "scale",
      name: "severity",
      instructions: "Severity?",
      levels: [createScaleLevel({ label: "Low" }), createScaleLevel()],
    });
    draft.questions.push(score);
    const errors = validateDecisionDraft(draft);
    expect(errors.byQuestionId[score.id]).toEqual({
      levelLabels: { [score.levels[1].id]: "Required" },
    });
    expect(getDecisionValidationError(draft)).toBe(
      "severity: every level needs a label"
    );
  });

  it("holds back empty required fields until the user has left them", () => {
    const draft = createDecisionDraft();
    draft.state = templateState("");
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

  it("rejects an inputs state without inputs, empty questions, and duplicate names", () => {
    const base = createDecisionDraft();
    expect(getDecisionValidationError({ ...base, state: inputsState() })).toBe(
      "Add at least one input"
    );
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
        type: "predicate",
        name: "urgent",
        instructions: "Urgent?",
      })
    );
    draft.questions.push(
      createDecisionQuestion({
        type: "scale",
        name: "severity",
        instructions: "Severity?",
        levels: [
          createScaleLevel({ label: "Low" }),
          createScaleLevel({ label: "High" }),
        ],
      })
    );
    const request = buildSystemOneRequest({ draft });
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
      buildSystemOneRequest({ draft }).questions.department.criteria
    ).toEqual({
      yes: null,
      no: null,
    });
  });

  it("caps the question count like the server does", () => {
    const draft = createDecisionDraft();
    draft.questions = Array.from({ length: 256 }, (_, index) =>
      createDecisionQuestion({
        type: "predicate",
        name: `q${index}`,
        instructions: "?",
      })
    );
    expect(getDecisionValidationError(draft)).toBe("At most 255 questions");
  });

  it("keeps input values literal without substituting Mustache variables", () => {
    const draft = createDecisionDraft();
    draft.state = inputsState("note", "plan");
    const variables = { note: '{"text": "{{plan}}"}', plan: "pro" };
    expect(
      buildSystemOneRequest({
        draft,
        templateFormat: TemplateFormats.Mustache,
        variables,
      }).state
    ).toEqual({ note: { text: "{{plan}}" }, plan: "pro" });
    expect(
      buildDecisionInput({
        draft,
        templateFormat: TemplateFormats.Mustache,
        variables,
      })
    ).toMatchObject({
      inputs: [{ name: "note" }, { name: "plan" }],
      state: { object: true },
      inputValues: { note: { text: "{{plan}}" }, plan: "pro" },
    });
  });

  it("handles question names that overlap Object.prototype safely", () => {
    const draft = createDecisionDraft();
    draft.questions[0].name = "__proto__";
    expect(
      Object.hasOwn(buildSystemOneRequest({ draft }).questions, "__proto__")
    ).toBe(true);
  });
});

describe("template variables", () => {
  it("extracts variables from text state and explicit input declarations, leaving questions literal", () => {
    const draft = createDecisionDraft();
    draft.state = templateState("Ticket: {{ticket}}");
    draft.questions[0].instructions = "Route for {{team}}";
    draft.questions[0].choices[0].description = "Owned by {{owner}}";
    expect(
      extractDecisionVariables({
        draft,
        templateFormat: TemplateFormats.Mustache,
      })
    ).toEqual(["ticket"]);
    expect(
      extractDecisionVariables({ draft, templateFormat: TemplateFormats.NONE })
    ).toEqual([]);
  });

  it("applies variables to text state while keeping question text literal", () => {
    const draft = createDecisionDraft();
    draft.state = templateState("Ticket: {{ticket}}");
    draft.questions[0].instructions = "Route {{ticket}}";
    const request = buildSystemOneRequest({
      draft,
      templateFormat: TemplateFormats.Mustache,
      variables: { ticket: "T-1" },
    });
    expect(request.state).toBe("Ticket: T-1");
    expect(request.questions.department.instructions).toBe("Route {{ticket}}");
  });

  it("includes explicitly declared section inputs and metadata in text mode", () => {
    const draft = {
      ...createDecisionDraft(),
      state: templateState("Customer: {{#urgent}}{{customer_name}}{{/urgent}}"),
      additionalInputNames: ["customer_name"],
      inputs: [
        { name: "urgent", description: "Is urgent" },
        {
          name: "customer_name",
          description: "Customer name",
          jsonSchema: { type: "string" },
        },
      ],
    };
    expect(
      extractDecisionVariables({
        draft,
        templateFormat: TemplateFormats.Mustache,
      })
    ).toEqual(["urgent", "customer_name"]);
    expect(
      buildDecisionInput({
        draft,
        templateFormat: TemplateFormats.Mustache,
        variables: { urgent: "yes", customer_name: "Alice" },
      })
    ).toMatchObject({
      inputs: [
        { name: "urgent", description: "Is urgent" },
        {
          name: "customer_name",
          description: "Customer name",
          jsonSchema: { type: "string" },
        },
      ],
      state: {
        text: {
          template: "Customer: {{#urgent}}{{customer_name}}{{/urgent}}",
          templateFormat: "MUSTACHE",
        },
      },
      inputValues: { urgent: "yes", customer_name: "Alice" },
    });
  });
});

describe("request import", () => {
  const draft = (() => {
    const base = createDecisionDraft();
    base.questions.push(
      createDecisionQuestion({
        type: "predicate",
        name: "urgent",
        instructions: "Urgent?",
        predicate: { trueDescription: "Time sensitive", falseDescription: "" },
      })
    );
    base.questions.push(
      createDecisionQuestion({
        type: "scale",
        name: "severity",
        instructions: "Severity?",
        levels: [
          createScaleLevel({ label: "Low" }),
          createScaleLevel({ label: "High" }),
        ],
      })
    );
    return base;
  })();

  it("imports a System One body and round-trips it", () => {
    const original = buildSystemOneRequest({ draft });
    const imported = parseDecisionImport(
      JSON.stringify({ model: "jev-latest", ...original })
    );
    expect(imported.model).toBe("jev-latest");
    expect(getDecisionValidationError(imported.draft)).toBeNull();
    expect(buildSystemOneRequest({ draft: imported.draft })).toEqual(original);
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
    expect(imported.draft.state).toEqual(templateState("I was charged twice."));
    expect(imported.inputValues).toBeUndefined();
    const request = buildSystemOneRequest({ draft: imported.draft });
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

  it("imports a one-key object as one input wrapped in an object, and types survive", () => {
    const state = { score: 5, passed: true, note: null, label: "5" };
    const imported = parseDecisionImport(
      JSON.stringify({
        state: { answer: state },
        questions: { urgent: { type: "noul", instructions: "Urgent?" } },
      })
    );
    expect(imported.draft.state).toEqual(inputsState("answer"));
    expect(
      buildSystemOneRequest({
        draft: imported.draft,
        variables: imported.inputValues,
      }).state
    ).toEqual({ answer: state });
    const flat = parseDecisionImport(
      JSON.stringify({
        state,
        questions: { urgent: { type: "noul", instructions: "Urgent?" } },
      })
    );
    expect(
      buildSystemOneRequest({
        draft: flat.draft,
        variables: flat.inputValues,
      }).state
    ).toEqual(state);
  });

  it("imports a keyed object state as inputs with their values", () => {
    const imported = parseDecisionImport(
      JSON.stringify({
        state: { events: ["refund"], plan: "pro" },
        questions: { urgent: { type: "noul", instructions: "Urgent?" } },
      })
    );
    expect(imported.draft.state).toEqual(inputsState("events", "plan"));
    expect(imported.inputValues).toEqual({
      events: '[\n  "refund"\n]',
      plan: "pro",
    });
    // The values in the Inputs panel send the state that was imported.
    expect(
      buildSystemOneRequest({
        draft: imported.draft,
        variables: imported.inputValues,
      }).state
    ).toEqual({ events: ["refund"], plan: "pro" });
  });

  it("imports any other structured state through one input named state", () => {
    const imported = parseDecisionImport(
      JSON.stringify({
        model: "gpt-6-luna",
        input: ["refund", "chargeback"],
        questions: [{ type: "predicate", name: "urgent", instructions: "?" }],
      })
    );
    expect(imported.draft.state).toEqual(valueState("state"));
    expect(
      buildSystemOneRequest({
        draft: imported.draft,
        variables: imported.inputValues,
      }).state
    ).toEqual(["refund", "chargeback"]);
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
        type: "predicate",
        name: "urgent",
        instructions: "?",
      }),
      createDecisionQuestion({
        type: "scale",
        name: "severity",
        instructions: "?",
        levels: [
          createScaleLevel({ label: "Low" }),
          createScaleLevel({ label: "High" }),
        ],
      }),
      createDecisionQuestion({
        type: "predicate",
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
      "predicate",
      "scale",
      "refusal",
    ]);
    const score = result.answers[1];
    if (score.kind === "scale") {
      expect(score.levels.map((level) => level.label)).toEqual(["0", "1"]);
      expect(score.expectedLevel).toBe(0.7);
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
      { kind: "predicate", name: "urgent", probability: 0.9 },
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
        type: "predicate",
        name: "urgent",
        instructions: "Urgent?",
        predicate: { trueDescription: "Time sensitive", falseDescription: "" },
      })
    );
    base.questions.push(
      createDecisionQuestion({
        type: "scale",
        name: "severity",
        instructions: "Severity?",
        levels: [
          createScaleLevel({ label: "Low" }),
          createScaleLevel({ label: "High" }),
        ],
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
    expect(messages[1].content).toBe(draft.state.template);
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
      state: inputsState("reference", "output"),
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
      state: templateState("Plan: {{plan}}\nTicket: {{ticket}}"),
    };
    const input = buildDecisionInput({
      draft,
      templateFormat: TemplateFormats.Mustache,
      variables: { plan: "pro" },
    });
    expect(input.inputs).toEqual([{ name: "plan" }, { name: "ticket" }]);
    expect(input.state).toEqual({
      text: { template: draft.state.template, templateFormat: "MUSTACHE" },
    });
    // Every declared input needs a value; an unset variable is sent empty.
    expect(input.inputValues).toEqual({ plan: "pro", ticket: "" });
  });

  it("sends JSON values as JSON, other text as text", () => {
    const draft = {
      ...createDecisionDraft(),
      state: inputsState("plan", "events", "count", "note"),
    };
    const input = buildDecisionInput({
      draft,
      variables: {
        plan: '{"tier":"pro"}',
        events: ' ["refund"] ',
        count: "3",
        note: "{not json",
      },
    });
    expect(input.state).toEqual({ object: true });
    expect(input.inputValues).toEqual({
      plan: { tier: "pro" },
      events: ["refund"],
      count: 3,
      note: "{not json",
    });
  });

  it("sends listed inputs as an object state, valued from the variables", () => {
    const draft = {
      ...createDecisionDraft(),
      state: inputsState("reference", "output"),
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
      buildSystemOneRequest({ draft, variables: { reference: "billing" } })
        .state
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
      state: inputsState("reference", "output"),
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
    const draft = createDecisionDraft();
    expect(
      validateDecisionDraft({ ...draft, state: inputsState() }).state
    ).toBe("Add at least one input");
    expect(
      validateDecisionDraft({ ...draft, state: inputsState(" ") }).state
    ).toBe("Input names cannot be empty");
    expect(
      validateDecisionDraft({ ...draft, state: inputsState("a", "b", "a") })
        .state
    ).toBe('Input "a" is listed twice');
  });

  it("sends one input's value alone as that input, unchanged, in both ad-hoc and dataset runs", () => {
    const draft = {
      ...createDecisionDraft(),
      state: valueState("ticket"),
    };
    expect(
      buildDecisionInput({
        draft,
        templateFormat: TemplateFormats.NONE,
        variables: { ticket: "Refund" },
      })
    ).toMatchObject({
      inputs: [{ name: "ticket" }],
      state: { input: "ticket" },
      inputValues: { ticket: "Refund" },
    });
    expect(
      buildDecisionTaskDefinition({
        draft,
        templateFormat: TemplateFormats.NONE,
      })
    ).toMatchObject({
      inputs: [{ name: "ticket" }],
      state: { input: "ticket" },
    });
    expect(
      extractDecisionVariables({
        draft,
        templateFormat: TemplateFormats.NONE,
      })
    ).toEqual(["ticket"]);
    expect(
      buildSystemOneRequest({
        draft,
        variables: { ticket: '{"subject":"Refund"}' },
      }).state
    ).toEqual({ subject: "Refund" });
  });

  it("builds one @oneOf input per question with literal question text", () => {
    const draft = createDecisionDraft();
    draft.questions = [
      createDecisionQuestion({
        type: "predicate",
        name: "urgent",
        instructions: "Is {{who}} waiting?",
        predicate: { trueDescription: "Time sensitive", falseDescription: "" },
      }),
      createDecisionQuestion({
        type: "scale",
        name: "severity",
        instructions: "How severe?",
        levels: [
          createScaleLevel({ label: "Low" }),
          createScaleLevel({ label: "{{who}}", description: "Blocks {{who}}" }),
        ],
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
          instructions: "Is {{who}} waiting?",
          criteria: { true: "Time sensitive", false: null },
        },
      },
      {
        scale: {
          name: "severity",
          instructions: "How severe?",
          levels: [
            { label: "Low", description: null },
            { label: "{{who}}", description: "Blocks {{who}}" },
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
    // Phoenix's run-output vocabulary, as experiment runs store it.
    expect(output.answers.severity).toEqual({
      type: "scale",
      expected_level: 0.4,
      confidence: 0.7,
      probabilities: { 0: 0.6, 1: 0.4 },
    });
    expect(output.answers.department).toMatchObject({
      probabilities: { billing: 0.8, technical: 0.2 },
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
      expect.objectContaining({
        kind: "scale",
        name: "severity",
        expectedLevel: 0.4,
      })
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

describe("inputs state shape", () => {
  it("sends one input alone only when asked, and several always as an object", () => {
    expect(getDecisionInputsStateShape(inputsState("ticket"))).toEqual({
      shape: "object",
      names: ["ticket"],
    });
    expect(getDecisionInputsStateShape(valueState("ticket"))).toEqual({
      shape: "value",
      name: "ticket",
    });
    expect(
      getDecisionInputsStateShape({
        ...valueState("ticket"),
        inputNames: ["ticket", "plan"],
      })
    ).toEqual({ shape: "object", names: ["ticket", "plan"] });
  });

  it("describes the state as sent, for Copy and the collapsed card", () => {
    expect(describeDecisionInputsState(inputsState())).toBe("");
    expect(describeDecisionInputsState(valueState("ticket"))).toBe("<ticket>");
    expect(describeDecisionInputsState(inputsState("ticket"))).toBe(
      '{ "ticket": <ticket> }'
    );
    expect(describeDecisionInputsState(inputsState("a", "b"))).toBe(
      '{ "a": <a>, "b": <b> }'
    );
  });
});

describe("switching the state mode", () => {
  it("does not seed a template without a template format", () => {
    expect(
      switchDecisionStateMode({
        state: inputsState("a", "b"),
        mode: "template",
        templateFormat: TemplateFormats.NONE,
      }).template
    ).toBe("");
  });

  const mustache = TemplateFormats.Mustache;

  it("starts an empty template from the input names, in the template format", () => {
    const state = inputsState("reference", "output");
    expect(
      switchDecisionStateMode({
        state,
        mode: "template",
        templateFormat: mustache,
      })
    ).toEqual({
      mode: "template",
      template: "reference: {{reference}}\noutput: {{output}}",
      inputNames: ["reference", "output"],
      inputsShape: "object",
    });
    expect(
      inputNamesToTemplate(valueState("ticket"), TemplateFormats.FString)
    ).toBe("{ticket}");
    expect(
      inputNamesToTemplate(inputsState("ticket"), TemplateFormats.FString)
    ).toBe("ticket: {ticket}");
  });

  it("starts empty input names from the template's variables", () => {
    expect(
      switchDecisionStateMode({
        state: templateState("Plan {{plan.tier}}: {{ticket}} {{plan}}"),
        mode: "inputs",
        templateFormat: mustache,
      }).inputNames
    ).toEqual(["plan", "ticket"]);
  });

  it("keeps what each mode holds when switching back and forth", () => {
    const state = createDecisionStateDraft({
      mode: "inputs",
      template: "Ticket: {{ticket}}",
      inputNames: ["reference"],
    });
    const asTemplate = switchDecisionStateMode({
      state,
      mode: "template",
      templateFormat: mustache,
    });
    expect(asTemplate.template).toBe("Ticket: {{ticket}}");
    expect(
      switchDecisionStateMode({
        state: asTemplate,
        mode: "inputs",
        templateFormat: mustache,
      })
    ).toEqual(state);
  });
});

describe("structured input values", () => {
  it.each([
    ['{"a": 1}', { a: 1 }],
    [" [1, 2] ", [1, 2]],
    ["3", 3],
    ["-1.5", -1.5],
    ['"text"', "text"],
    ['"5"', "5"],
    ["true", true],
    ["null", null],
    ["{broken", "{broken"],
    ["hello", "hello"],
    ["", ""],
    ["   ", "   "],
    [undefined, ""],
  ])("reads %j as %j", (value, expected) => {
    expect(toStructuredInputValue(value)).toEqual(expected);
  });

  it.each([
    ["hello", "hello"],
    ["5", '"5"'],
    ["true", '"true"'],
    ['{"a":1}', '"{\\"a\\":1}"'],
    [5, "5"],
    [true, "true"],
    [null, "null"],
    [{ a: 1 }, '{\n  "a": 1\n}'],
  ])("writes %j as %j, which reads back the same", (value, text) => {
    expect(toInputValueText(value)).toBe(text);
    expect(toStructuredInputValue(toInputValueText(value))).toEqual(value);
  });
});

describe("decision tasks over a dataset", () => {
  const mustache = TemplateFormats.Mustache;

  it("passes one input sent alone through as that input", () => {
    const draft = {
      ...createDecisionDraft(),
      state: valueState("state"),
    };
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

  it("keeps a single-variable text state as a text template across ad-hoc and dataset runs", () => {
    const draft = {
      ...createDecisionDraft(),
      state: templateState("{{state}}"),
    };
    expect(
      buildDecisionInput({
        draft,
        templateFormat: mustache,
        variables: { state: "Refund" },
      }).state
    ).toEqual({
      text: { template: "{{state}}", templateFormat: "MUSTACHE" },
    });
    expect(
      buildDecisionTaskDefinition({
        draft,
        templateFormat: mustache,
      }).state
    ).toEqual({
      text: { template: "{{state}}", templateFormat: "MUSTACHE" },
    });
  });

  it("sends any other text state as a template over its variables", () => {
    const draft = {
      ...createDecisionDraft(),
      state: templateState("Ticket: {{ticket}} (plan {{plan}})"),
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
      state: templateState("{ticket.subject}: {ticket[0]} ({topic} / {topic})"),
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

  it("does not treat JSON braces in an input value as f-string variables", () => {
    const draft = {
      ...createDecisionDraft(),
      state: valueState("nested"),
    };
    expect(
      extractDecisionVariables({
        draft,
        templateFormat: TemplateFormats.FString,
      })
    ).toEqual(["nested"]);
    expect(
      buildDecisionInput({
        draft,
        templateFormat: TemplateFormats.FString,
        variables: { nested: '{"id": 1}' },
      })
    ).toMatchObject({
      inputs: [{ name: "nested" }],
      state: { input: "nested" },
      inputValues: { nested: { id: 1 } },
    });
  });

  it("explains what a dataset can't fill", () => {
    const draft = createDecisionDraft();
    expect(getDecisionDatasetProblem({ draft, templateFormat: mustache })).toBe(
      "Over a dataset, the state template needs a variable that each example fills, or switch the state to Inputs."
    );
    expect(
      getDecisionDatasetProblem({
        draft,
        templateFormat: TemplateFormats.NONE,
        purpose: "save",
      })
    ).toBe(
      "To save, pick Mustache or F-String for the state template, or switch the state to Inputs."
    );
    expect(
      getDecisionDatasetProblem({
        draft: { ...draft, state: inputsState("ticket") },
        templateFormat: TemplateFormats.NONE,
      })
    ).toBeNull();
  });

  it("lets decisions and prompts share a dataset run, checking only the decisions", () => {
    const decision = {
      task: { type: "decision" },
      decisionPrompt: {
        ...createDecisionDraft(),
        state: templateState("{{state}}"),
      },
    } as never;
    const unfillable = {
      task: { type: "decision" },
      decisionPrompt: createDecisionDraft(),
    } as never;
    const prompt = {
      task: { type: "prompt" },
      decisionPrompt: null,
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
      kind: "scale",
      name: "urgency",
      expectedLevel: 1.3,
      confidence: 0.4,
      levels: [
        { index: 0, probability: 0.2 },
        { index: 1, probability: 0.3 },
        { index: 2, probability: 0.5 },
      ],
    });
  });
});

describe("getChatForDecisionToPrompt", () => {
  it("asks an LLM the same questions when the decision has no messages", () => {
    const draft = createDecisionDraft();
    const chat = getChatForDecisionToPrompt({
      instance: { template: { __type: "chat", messageIds: [] } },
      decisionPrompt: draft,
      templateFormat: TemplateFormats.Mustache,
    });
    expect(chat?.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
    ]);
    expect(chat?.messages[1].content).toBe(draft.state.template);
    expect(chat?.responseFormat.type).toBe("json_schema");
  });

  it("keeps the messages a decision instance already had", () => {
    expect(
      getChatForDecisionToPrompt({
        instance: { template: { __type: "chat", messageIds: [1, 2] } },
        decisionPrompt: createDecisionDraft(),
        templateFormat: TemplateFormats.Mustache,
      })
    ).toBeNull();
  });
});
