import { describe, expect, it } from "vitest";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { DEFAULT_INSTANCE_PARAMS } from "@phoenix/store/playground";
import type { DecisionRequestDraft } from "@phoenix/store/playground/types";

import {
  buildDecisionInput,
  createChoiceOption,
  createDecisionQuestion,
  createScaleLevel,
  extractDecisionVariables,
} from "../decisionUtils";
import type {
  DecisionVersionInput,
  SavedDecisionVersion,
} from "../savedDecisionUtils";
import {
  savedDecisionVersionToDraft,
  toDecisionVersionInput,
} from "../savedDecisionUtils";

const mustache = TemplateFormats.Mustache;
const fString = TemplateFormats.FString;

function makeDraft(state: string): DecisionRequestDraft {
  return {
    state,
    stateEditorMode: "text",
    questions: [
      createDecisionQuestion({
        type: "predicate",
        name: "is_refund",
        instructions: "Is this a refund request?",
        predicate: {
          trueDescription: "Asks for money back",
          falseDescription: "",
        },
      }),
      createDecisionQuestion({
        type: "choice",
        name: "department",
        instructions: "Which team handles it?",
        choices: [
          createChoiceOption({ value: "billing", description: "Payments" }),
          createChoiceOption({ value: "technical" }),
        ],
      }),
      createDecisionQuestion({
        type: "scale",
        name: "urgency",
        instructions: "How urgent is it?",
        levels: [
          createScaleLevel({ label: "Whenever" }),
          createScaleLevel({ label: "Now", description: "Act today" }),
        ],
      }),
    ],
  };
}

function makeInstance(draft: DecisionRequestDraft | null) {
  return {
    decisionRequest: draft,
    model: {
      provider: "OLLAMA" as const,
      modelName: " tev1:0.8b-mxfp8 ",
      modelType: "DECISION" as const,
      invocationParameters:
        DEFAULT_INSTANCE_PARAMS().model.invocationParameters,
      customProvider: null,
    },
  };
}

/** The saved version the server would hold for a version input, as it is read back. */
function toSavedVersion(input: DecisionVersionInput): SavedDecisionVersion {
  return {
    inputs: input.inputs,
    state:
      "input" in input.state
        ? { kind: "input", input: input.state.input }
        : "object" in input.state
          ? { kind: "object", inputs: input.inputs.map(({ name }) => name) }
          : {
              kind: "text",
              template: input.state.text.template,
              templateFormat: input.state.text.templateFormat,
            },
    questions: input.questions.map((question) => {
      if ("predicate" in question) {
        return { kind: "predicate", ...question.predicate };
      }
      if ("choice" in question) {
        return { kind: "choice", ...question.choice };
      }
      if ("scale" in question) {
        return { kind: "scale", ...question.scale };
      }
      throw new Error("Unexpected question");
    }),
  };
}

/** A draft without the ids the editor mints, to compare content. */
function withoutIds(draft: DecisionRequestDraft) {
  return {
    ...draft,
    questions: draft.questions.map(({ id: _id, choices, levels, ...rest }) => ({
      ...rest,
      choices: choices.map(({ id: _choiceId, ...choice }) => choice),
      levels: levels.map(({ id: _levelId, ...level }) => level),
    })),
  };
}

describe("toDecisionVersionInput", () => {
  it("writes the decision as a function of its inputs, with the model that answers", () => {
    const input = toDecisionVersionInput({
      instance: makeInstance(makeDraft("Ticket: {{ticket}} on {{plan}}")),
      templateFormat: mustache,
      description: "  first cut  ",
    });

    expect(input).toMatchObject({
      inputs: [{ name: "ticket" }, { name: "plan" }],
      state: {
        text: {
          template: "Ticket: {{ticket}} on {{plan}}",
          templateFormat: "MUSTACHE",
        },
      },
      modelProvider: "OLLAMA",
      // Trimmed, like the run input.
      modelName: "tev1:0.8b-mxfp8",
      customProviderId: null,
      description: "first cut",
    });
    expect(input.questions).toHaveLength(3);
  });

  it("passes an input state as that input", () => {
    expect(
      toDecisionVersionInput({
        instance: makeInstance({
          ...makeDraft("ticket"),
          stateEditorMode: "input",
        }),
        templateFormat: fString,
      })
    ).toMatchObject({
      inputs: [{ name: "ticket" }],
      state: { input: "ticket" },
    });
  });

  it("names the custom provider by id", () => {
    const instance = makeInstance(makeDraft("{{ticket}}"));

    expect(
      toDecisionVersionInput({
        instance: {
          ...instance,
          model: {
            ...instance.model,
            customProvider: { id: "CP1", name: "my-typesafe" },
          },
        },
        templateFormat: mustache,
      })
    ).toMatchObject({ customProviderId: "CP1" });
  });

  it("refuses what cannot be saved, saying why", () => {
    expect(() =>
      toDecisionVersionInput({
        instance: makeInstance(null),
        templateFormat: mustache,
      })
    ).toThrow("no decision to save");
    expect(() =>
      toDecisionVersionInput({
        instance: {
          ...makeInstance(makeDraft("{{ticket}}")),
          model: { ...makeInstance(null).model, modelName: "  " },
        },
        templateFormat: mustache,
      })
    ).toThrow("Pick a decision model");
    // Saved for callers to fill, so the state needs something to fill.
    expect(() =>
      toDecisionVersionInput({
        instance: makeInstance(makeDraft("no variables here")),
        templateFormat: mustache,
      })
    ).toThrow(
      "To save, the state needs a template variable that each caller fills"
    );
    expect(() =>
      toDecisionVersionInput({
        instance: {
          ...makeInstance(makeDraft("{{ticket}}")),
          model: { ...makeInstance(null).model, modelName: "  " },
        },
        templateFormat: mustache,
        purpose: "test",
      })
    ).toThrow("Pick a decision model to test.");
    expect(() =>
      toDecisionVersionInput({
        instance: makeInstance(makeDraft("no variables here")),
        templateFormat: mustache,
        purpose: "test",
      })
    ).toThrow(
      "To test, the state needs a template variable that each example fills"
    );
  });
});

describe("savedDecisionVersionToDraft", () => {
  it("round-trips a text state with predicate, choice and scale questions", () => {
    const draft = makeDraft("Ticket: {{ticket}} on {{plan}}");
    const saved = toSavedVersion(
      toDecisionVersionInput({
        instance: makeInstance(draft),
        templateFormat: mustache,
      })
    );

    const loaded = savedDecisionVersionToDraft({
      version: saved,
      templateFormat: mustache,
    });

    expect(withoutIds(loaded)).toEqual(withoutIds(draft));
  });

  it("preserves a single-variable text state across load and save", () => {
    const version: SavedDecisionVersion = {
      inputs: [{ name: "state" }],
      state: {
        kind: "text",
        template: "{{state}}",
        templateFormat: "MUSTACHE",
      },
      questions: [
        {
          kind: "predicate",
          name: "is_refund",
          instructions: "Refund?",
          criteria: null,
        },
      ],
    };
    const loaded = savedDecisionVersionToDraft({
      version,
      templateFormat: mustache,
    });
    expect(loaded).toMatchObject({
      state: "{{state}}",
      stateEditorMode: "text",
    });
    expect(
      toDecisionVersionInput({
        instance: makeInstance(loaded),
        templateFormat: mustache,
      }).state
    ).toEqual({
      text: { template: "{{state}}", templateFormat: "MUSTACHE" },
    });
  });

  it("round-trips an input state in any template format, including NONE", () => {
    for (const format of [mustache, fString, TemplateFormats.NONE] as const) {
      const draft = {
        ...makeDraft("ticket"),
        stateEditorMode: "input" as const,
      };
      const saved = toSavedVersion(
        toDecisionVersionInput({
          instance: makeInstance(draft),
          templateFormat: format,
        })
      );

      expect(saved.state).toEqual({ kind: "input", input: "ticket" });
      expect(
        savedDecisionVersionToDraft({ version: saved, templateFormat: format })
      ).toMatchObject({
        state: "ticket",
        stateEditorMode: "input",
      });
    }
  });

  it("preserves input descriptions, JSON schemas, and section-scoped inputs across load and save", () => {
    const version: SavedDecisionVersion = {
      inputs: [
        { name: "urgent", description: "Whether urgent" },
        {
          name: "customer_name",
          description: "Customer",
          jsonSchema: { type: "string" },
        },
      ],
      state: {
        kind: "text",
        template: "Customer: {{#urgent}}{{customer_name}}{{/urgent}}",
        templateFormat: "MUSTACHE",
      },
      questions: [
        {
          kind: "predicate",
          name: "is_refund",
          instructions: "Refund?",
          criteria: null,
        },
      ],
    };
    const loaded = savedDecisionVersionToDraft({
      version,
      templateFormat: mustache,
    });
    const resaved = toDecisionVersionInput({
      instance: makeInstance(loaded),
      templateFormat: mustache,
    });
    expect(resaved.inputs).toEqual(version.inputs);
  });

  it("preserves additional declarations for input states in saves and ad-hoc runs", () => {
    const version: SavedDecisionVersion = {
      inputs: [
        { name: "ticket", description: "Ticket" },
        { name: "policy", jsonSchema: { type: "string" } },
      ],
      state: { kind: "input", input: "ticket" },
      questions: [
        {
          kind: "predicate",
          name: "urgent",
          instructions: "Urgent?",
          criteria: null,
        },
      ],
    };
    const loaded = savedDecisionVersionToDraft({
      version,
      templateFormat: TemplateFormats.NONE,
    });
    expect(
      extractDecisionVariables({
        draft: loaded,
        templateFormat: TemplateFormats.NONE,
      })
    ).toEqual(["ticket", "policy"]);
    expect(
      buildDecisionInput({
        draft: loaded,
        templateFormat: TemplateFormats.NONE,
        variables: { ticket: "Refund", policy: "Support policy" },
      })
    ).toMatchObject({
      inputs: version.inputs,
      state: { input: "ticket" },
      inputValues: { ticket: "Refund", policy: "Support policy" },
    });
    expect(
      toDecisionVersionInput({
        instance: makeInstance(loaded),
        templateFormat: TemplateFormats.NONE,
      }).inputs
    ).toEqual(version.inputs);
  });

  it.each(["text", "input"] as const)(
    "removes obsolete inferred inputs after editing a loaded %s state",
    (kind) => {
      const version: SavedDecisionVersion = {
        inputs: [
          {
            name: "ticket",
            description: "Ticket",
            jsonSchema: { type: "string" },
          },
          { name: "policy", description: "Explicit declaration" },
        ],
        state:
          kind === "text"
            ? {
                kind: "text",
                template: "{{ticket}}",
                templateFormat: "MUSTACHE",
              }
            : { kind: "input", input: "ticket" },
        questions: [
          {
            kind: "predicate",
            name: "urgent",
            instructions: "Urgent?",
            criteria: null,
          },
        ],
      };
      const loaded = savedDecisionVersionToDraft({
        version,
        templateFormat: mustache,
      });
      const edited = {
        ...loaded,
        state: kind === "text" ? "{{message}}" : "message",
      };
      const expectedInputs = [{ name: "message" }, version.inputs![1]];
      expect(
        extractDecisionVariables({ draft: edited, templateFormat: mustache })
      ).toEqual(["message", "policy"]);
      expect(
        buildDecisionInput({ draft: edited, templateFormat: mustache }).inputs
      ).toEqual(expectedInputs);
      expect(
        toDecisionVersionInput({
          instance: makeInstance(edited),
          templateFormat: mustache,
        }).inputs
      ).toEqual(expectedInputs);
      // Metadata remains available if the user restores the original reference.
      expect(
        toDecisionVersionInput({
          instance: makeInstance(loaded),
          templateFormat: mustache,
        }).inputs
      ).toEqual(version.inputs);
    }
  );

  it("reads a predicate without criteria and a choice without descriptions", () => {
    const loaded = savedDecisionVersionToDraft({
      version: {
        state: { kind: "input", input: "ticket" },
        questions: [
          {
            kind: "predicate",
            name: "is_refund",
            instructions: "Refund?",
            criteria: null,
          },
          {
            kind: "choice",
            name: "team",
            instructions: "Which?",
            choices: [{ value: "billing", description: null }],
          },
        ],
      },
      templateFormat: mustache,
    });

    expect(loaded.questions[0]).toMatchObject({
      type: "predicate",
      predicate: { trueDescription: "", falseDescription: "" },
    });
    expect(loaded.questions[1]).toMatchObject({
      type: "choice",
      choices: [{ value: "billing", description: "" }],
    });
  });

  it("loads an object state as its listed inputs, in either template format", () => {
    for (const templateFormat of [mustache, fString]) {
      expect(
        savedDecisionVersionToDraft({
          version: {
            state: { kind: "object", inputs: ["reference", "output"] },
            questions: [],
          },
          templateFormat,
        })
      ).toMatchObject({
        state: "reference, output",
        stateEditorMode: "inputs",
      });
    }
  });

  it("round-trips listed inputs as an object state", () => {
    const draft = {
      ...makeDraft("reference, output"),
      stateEditorMode: "inputs" as const,
    };
    const input = toDecisionVersionInput({
      instance: makeInstance(draft),
      templateFormat: mustache,
    });
    expect(input).toMatchObject({
      inputs: [{ name: "reference" }, { name: "output" }],
      state: { object: true },
    });

    const loaded = savedDecisionVersionToDraft({
      version: toSavedVersion(input),
      templateFormat: mustache,
    });
    expect(withoutIds(loaded)).toEqual(withoutIds(draft));
  });

  it("refuses a text state written in the other template format", () => {
    const version: SavedDecisionVersion = {
      state: {
        kind: "text",
        template: "{ticket} again",
        templateFormat: "F_STRING",
      },
      questions: [],
    };

    expect(() =>
      savedDecisionVersionToDraft({ version, templateFormat: mustache })
    ).toThrow("written in F-String");
    expect(
      savedDecisionVersionToDraft({ version, templateFormat: fString }).state
    ).toBe("{ticket} again");
  });
});
