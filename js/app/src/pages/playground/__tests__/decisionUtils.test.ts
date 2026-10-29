import {
  normalizeDecisionAnswer,
  normalizeDecisionResult,
} from "@phoenix/components/decision/decisionAnswers";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import { DEFAULT_INSTANCE_PARAMS } from "@phoenix/store/playground";
import type { PlaygroundInstance } from "@phoenix/store/playground/types";

import {
  buildChatFromDecisionDraft,
  buildDecisionInstanceFromSpanAttributes,
  buildDecisionConnection,
  buildDecisionInput,
  buildDecisionTaskDefinition,
  createChoiceOption,
  createDecisionDraft,
  createDecisionQuestion,
  createDecisionStateDraft,
  createScaleLevel,
  decisionFieldId,
  extractDecisionVariables,
  getChatForDecisionToPrompt,
  getDecisionValidationError,
  getImportedTemplateFormat,
  getJsonTemplateStringLeaves,
  maskUntouchedErrors,
  parseDecisionImport,
  readDecisionVariable,
  switchDecisionStateMode,
  toDecisionJsonSchema,
  toDecisionOutput,
  toDecisionVariableValues,
  toJsonTemplateOfVariables,
  validateDecisionDraft,
} from "../decisionUtils";

/** A text state. */
const templateState = (text: string) => createDecisionStateDraft({ text });

/** A JSON state, written as given. */
const jsonState = (json: string) =>
  createDecisionStateDraft({ mode: "json", json });

describe("decision prompt draft", () => {
  it("builds a valid Choice example", () => {
    const draft = createDecisionDraft();
    expect(
      getDecisionValidationError({
        draft,
        templateFormat: TemplateFormats.Mustache,
      })
    ).toBeNull();
    const input = buildDecisionInput({
      draft,
      templateFormat: TemplateFormats.Mustache,
      variables: {},
    });
    expect(input.questions[0]).toEqual({
      choice: {
        name: "department",
        instructions: "Which department should handle this request?",
        choices: [
          { value: "billing", description: "Payments, invoices, and refunds" },
          { value: "technical", description: "Problems using the product" },
          { value: "other", description: "Requests outside these categories" },
        ],
      },
    });
  });

  it("reports field-level errors instead of one banner", () => {
    const draft = createDecisionDraft();
    draft.state = templateState("   ");
    draft.questions[0].name = "";
    draft.questions[0].choices[1].value = "billing";
    const errors = validateDecisionDraft({
      draft,
      templateFormat: TemplateFormats.Mustache,
    });
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
    const errors = validateDecisionDraft({
      draft,
      templateFormat: TemplateFormats.Mustache,
    });
    expect(errors.byQuestionId[score.id]).toEqual({
      levelLabels: { [score.levels[1].id]: "Required" },
    });
    expect(
      getDecisionValidationError({
        draft,
        templateFormat: TemplateFormats.Mustache,
      })
    ).toBe("severity: every level needs a label");
  });

  it("holds back empty required fields until the user has left them", () => {
    const draft = createDecisionDraft();
    draft.state = templateState("");
    draft.questions[0].name = "";
    draft.questions[0].instructions = "";
    const [choice] = draft.questions;
    choice.choices[0].value = "";
    const errors = validateDecisionDraft({
      draft,
      templateFormat: TemplateFormats.Mustache,
    });
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
    expect(
      getDecisionValidationError({
        draft,
        templateFormat: TemplateFormats.Mustache,
      })
    ).not.toBeNull();
  });

  it("shows duplicate and count errors without waiting", () => {
    const draft = createDecisionDraft();
    const [choice] = draft.questions;
    choice.choices[1].value = "billing";
    draft.questions.push({ ...choice, id: "copy" });
    const masked = maskUntouchedErrors({
      errors: validateDecisionDraft({
        draft,
        templateFormat: TemplateFormats.Mustache,
      }),
      touched: new Set(),
    });
    expect(masked.byQuestionId.copy?.name).toBe("Duplicate name");
    expect(masked.byQuestionId[choice.id]?.choiceOptions).toEqual({
      [choice.choices[1].id]: "Duplicate",
    });
    expect(
      maskUntouchedErrors({
        errors: validateDecisionDraft({
          draft: { ...draft, questions: [] },
          templateFormat: TemplateFormats.Mustache,
        }),
        touched: new Set(),
      }).questions
    ).toBe("Add at least one question");
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
    expect(
      getDecisionValidationError({
        draft,
        templateFormat: TemplateFormats.Mustache,
      })
    ).toBe("At most 255 questions");
  });
});

describe("answer normalization", () => {
  it("normalizes a System One response most likely first, ties in the author's order", () => {
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
      expect.objectContaining({
        kind: "predicate",
        name: "urgent",
        probability: 0.9,
        choice: "True",
      }),
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
    });
    expect(messages.map((message) => message.role)).toEqual(["system", "user"]);
    expect(messages[1].content).toBe(draft.state.text);
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
    });
    expect(chat?.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
    ]);
    expect(chat?.messages[1].content).toBe(draft.state.text);
    expect(chat?.responseFormat.type).toBe("json_schema");
  });

  it("keeps the messages a decision instance already had", () => {
    expect(
      getChatForDecisionToPrompt({
        instance: { template: { __type: "chat", messageIds: [1, 2] } },
        decisionPrompt: createDecisionDraft(),
      })
    ).toBeNull();
  });
});

describe("state validation", () => {
  it("requires a JSON state to be an object, a list or a non-empty string", () => {
    const base = createDecisionDraft();
    const errorFor = (
      json: string,
      templateFormat: TemplateFormat = TemplateFormats.Mustache
    ) =>
      validateDecisionDraft({
        draft: { ...base, state: jsonState(json) },
        templateFormat,
      }).state;
    expect(errorFor("")).toBe("State cannot be empty");
    expect(errorFor('{"a": ')).toBe("The state is not valid JSON");
    expect(errorFor("3")).toBe(
      "A JSON state must be an object, a list, or a string"
    );
    expect(errorFor("null")).toBe(
      "A JSON state must be an object, a list, or a string"
    );
    expect(errorFor('"  "')).toBe("State cannot be empty");
    expect(errorFor('"{{state}}"')).toBeUndefined();
    expect(errorFor("[1]")).toBeUndefined();
    // One bare tag is the whole state, under a format that reads it.
    expect(errorFor(" {{state}}\n")).toBeUndefined();
    expect(errorFor("{state}", TemplateFormats.FString)).toBeUndefined();
    expect(errorFor("{{state}}", TemplateFormats.NONE)).toBe(
      "The state is not valid JSON"
    );
  });
});

describe("decision variables", () => {
  it("are the root names of the state's and the question prose's tags, in order", () => {
    const draft = {
      state: jsonState(
        '{"{{key}}": "{{customer.tier}}", "note": "since {{since}}", "n": 1}'
      ),
      questions: [
        createDecisionQuestion({
          type: "choice",
          name: "route_{{x}}",
          instructions: "Route for {{customer}} and {{policy}}?",
          choices: [
            createChoiceOption({
              value: "{{team}}",
              description: "In {{days}}",
            }),
            createChoiceOption({ value: "other" }),
          ],
        }),
      ],
    };
    // Keys, names and choice values are not templates.
    expect(
      extractDecisionVariables({
        draft,
        templateFormat: TemplateFormats.Mustache,
      })
    ).toEqual(["customer", "since", "policy", "days"]);
    expect(
      extractDecisionVariables({ draft, templateFormat: TemplateFormats.NONE })
    ).toEqual([]);
  });

  it("keep their names while the JSON is being edited", () => {
    expect(
      getJsonTemplateStringLeaves({
        json: '{"a": "{{x}}", "b": ["{{y}}", ',
        templateFormat: TemplateFormats.Mustache,
      })
    ).toEqual(["{{x}}", "{{y}}"]);
    expect(
      extractDecisionVariables({
        draft: {
          ...createDecisionDraft(),
          state: jsonState('{"a": "{x}", "b": "{y'),
        },
        templateFormat: TemplateFormats.FString,
      })
    ).toEqual(["x"]);
  });

  it("read a bare tag as the whole state, and F-String paths by their root", () => {
    expect(
      extractDecisionVariables({
        draft: { ...createDecisionDraft(), state: jsonState("{{state}}") },
        templateFormat: TemplateFormats.Mustache,
      })
    ).toContain("state");
    expect(
      extractDecisionVariables({
        draft: {
          ...createDecisionDraft(),
          state: templateState("{ticket[id]} {customer.tier} {open:>3}"),
        },
        templateFormat: TemplateFormats.FString,
      }).slice(0, 3)
    ).toEqual(["ticket", "customer", "open"]);
  });
});

describe("variable values", () => {
  it("are read as JSON when they parse, and as text otherwise or when asked", () => {
    expect(readDecisionVariable({ text: '{"a": 1}' })).toMatchObject({
      kind: "value",
      value: { a: 1 },
      type: "object",
    });
    expect(readDecisionVariable({ text: "[1]" })).toMatchObject({
      type: "array",
    });
    expect(readDecisionVariable({ text: "3" })).toMatchObject({
      value: 3,
      type: "number",
    });
    expect(readDecisionVariable({ text: "false" })).toMatchObject({
      type: "boolean",
    });
    expect(readDecisionVariable({ text: "null" })).toMatchObject({
      value: null,
      type: "null",
    });
    expect(readDecisionVariable({ text: "Late refund" })).toMatchObject({
      value: "Late refund",
      type: "text",
      isJson: false,
    });
    expect(readDecisionVariable({ text: '"quoted"' })).toMatchObject({
      value: "quoted",
      type: "text",
    });
    expect(
      readDecisionVariable({ text: "3", isReadAsText: true })
    ).toMatchObject({
      value: "3",
      type: "text",
      isJson: true,
    });
    expect(readDecisionVariable({ text: "" })).toEqual({ kind: "missing" });
    expect(readDecisionVariable({ text: undefined })).toEqual({
      kind: "missing",
    });
  });

  it("leave out empty variables so the call reports them missing", () => {
    expect(
      toDecisionVariableValues({
        names: ["a", "b", "c", "d"],
        input: {
          variablesValueCache: { a: "1", b: "", c: "two", d: "4" },
          variablesReadAsText: { d: true },
        },
      })
    ).toEqual({ a: 1, c: "two", d: "4" });
  });
});

describe("a JSON state of variables", () => {
  it("has one variable per name, skipping names that aren't valid", () => {
    expect(
      JSON.parse(
        toJsonTemplateOfVariables({
          names: ["ticket", "two words", "since"],
          templateFormat: TemplateFormats.FString,
        })
      )
    ).toEqual({ ticket: "{ticket}", since: "{since}" });
  });
});

describe("switching the state mode", () => {
  it("keeps each mode's content and seeds an empty one from the variables", () => {
    const state = templateState("Ticket {{ticket}}");
    const json = switchDecisionStateMode({
      state,
      mode: "json",
      templateFormat: TemplateFormats.Mustache,
    });
    expect(json).toEqual({
      mode: "json",
      text: "Ticket {{ticket}}",
      json: JSON.stringify({ ticket: "{{ticket}}" }, null, 2),
    });
    const edited = { ...json, json: '{"t": "{{ticket}}", "p": "{{plan}}"}' };
    expect(
      switchDecisionStateMode({
        state: edited,
        mode: "text",
        templateFormat: TemplateFormats.Mustache,
      })
    ).toEqual({ ...edited, mode: "text" });
    expect(
      switchDecisionStateMode({
        state: { ...edited, text: "" },
        mode: "text",
        templateFormat: TemplateFormats.Mustache,
      }).text
    ).toBe("ticket: {{ticket}}\nplan: {{plan}}");
    // Without a template format nothing is a variable, so nothing is seeded.
    expect(
      switchDecisionStateMode({
        state,
        mode: "json",
        templateFormat: TemplateFormats.NONE,
      }).json
    ).toBe("");
  });
});

describe("runDecision input", () => {
  it("sends the template format, the state template and the variables", () => {
    const draft = {
      ...createDecisionDraft(),
      state: jsonState('{"customer": "{{customer}}", "n": 1}'),
    };
    expect(
      buildDecisionInput({
        draft,
        templateFormat: TemplateFormats.Mustache,
        variables: { customer: { tier: "gold" } },
      })
    ).toMatchObject({
      templateFormat: "MUSTACHE",
      state: { json: { customer: "{{customer}}", n: 1 } },
      variables: { customer: { tier: "gold" } },
    });
    expect(
      buildDecisionTaskDefinition({
        draft: { ...draft, state: templateState("Ticket {ticket}") },
        templateFormat: TemplateFormats.FString,
      })
    ).toMatchObject({
      templateFormat: "F_STRING",
      state: { text: "Ticket {ticket}" },
    });
  });

  it("refuses a JSON state that isn't valid JSON", () => {
    expect(() =>
      buildDecisionInput({
        draft: { ...createDecisionDraft(), state: jsonState("{") },
        templateFormat: TemplateFormats.Mustache,
        variables: {},
      })
    ).toThrow("The state is not valid JSON");
  });

  it("sends a bare tag as the JSON string that is the tag", () => {
    expect(
      buildDecisionInput({
        draft: { ...createDecisionDraft(), state: jsonState(" {{state}}\n") },
        templateFormat: TemplateFormats.Mustache,
        variables: { state: { a: 1 } },
      }).state
    ).toEqual({ json: "{{state}}" });
  });
});

describe("request import", () => {
  const systemOne = (state: string) =>
    `{"model": "jev", "state": ${state}, "questions": {"ok": {"type": "noul", "instructions": "Ok?"}}}`;

  it("opens a text state as Text and a structured one as JSON, with no holes", () => {
    const text = parseDecisionImport(systemOne('"Late refund"'));
    expect(text.draft.state).toEqual({
      mode: "text",
      text: "Late refund",
      json: "",
    });
    expect(text.templateFormat).toBe(TemplateFormats.Mustache);
    const json = parseDecisionImport(systemOne('{"ticket": "Late", "n": [1]}'));
    expect(json.draft.state).toEqual({
      mode: "json",
      text: "",
      json: JSON.stringify({ ticket: "Late", n: [1] }, null, 2),
    });
    expect(json.model).toBe("jev");
  });

  it("opens in None when anything in it would read as a tag", () => {
    expect(
      parseDecisionImport(systemOne('{"note": "Hi {{name}}"}')).templateFormat
    ).toBe(TemplateFormats.NONE);
    expect(
      parseDecisionImport(
        '{"state": "plain", "questions": {"ok": {"type": "noul", "instructions": "Is {{x}} ok?"}}}'
      ).templateFormat
    ).toBe(TemplateFormats.NONE);
    // A Mustache comment would be dropped, so it counts as a tag too.
    expect(
      getImportedTemplateFormat({
        ...createDecisionDraft(),
        state: templateState("a {{! note }} b"),
      })
    ).toBe(TemplateFormats.NONE);
    // Single braces read nothing under Mustache.
    expect(
      parseDecisionImport(systemOne(JSON.stringify('{"ticket": 1}')))
        .templateFormat
    ).toBe(TemplateFormats.Mustache);
  });

  it("keeps an own __proto__ key of the state", () => {
    const { draft, templateFormat } = parseDecisionImport(
      systemOne('{"__proto__": {"admin": true}, "ticket": "x"}')
    );
    const input = buildDecisionInput({ draft, templateFormat, variables: {} });
    expect(JSON.stringify(input.state)).toBe(
      '{"json":{"__proto__":{"admin":true},"ticket":"x"}}'
    );
  });

  it("imports an OpenAI Decisions body", () => {
    const { draft } = parseDecisionImport(
      JSON.stringify({
        model: "gpt-6",
        input: "Refund please",
        questions: [
          { type: "predicate", name: "refund", instructions: "Refund?" },
          {
            type: "choice",
            name: "team",
            instructions: "Team?",
            choices: [{ value: "billing" }, { value: true }],
          },
        ],
      })
    );
    expect(draft.state.text).toBe("Refund please");
    expect(draft.questions.map((question) => question.type)).toEqual([
      "predicate",
      "choice",
    ]);
    expect(draft.questions[1].choices.map((choice) => choice.value)).toEqual([
      "billing",
      "true",
    ]);
  });

  it("names the field a schema error refers to", () => {
    expect(() => parseDecisionImport('{"state": "x", "questions": 3}')).toThrow(
      "Not a valid System One request: questions"
    );
  });
});
