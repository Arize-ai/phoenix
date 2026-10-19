import { describe, expect, it } from "vitest";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { DEFAULT_INSTANCE_PARAMS } from "@phoenix/store/playground";
import type { DecisionRequestDraft } from "@phoenix/store/playground/types";

import {
  createChoiceOption,
  createDecisionQuestion,
  createScoreLevel,
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
    stateFormat: "text",
    questions: [
      createDecisionQuestion({
        type: "noul",
        name: "is_refund",
        instructions: "Is this a refund request?",
        noul: { trueDescription: "Asks for money back", falseDescription: "" },
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
        type: "score",
        name: "urgency",
        instructions: "How urgent is it?",
        levels: [createScoreLevel("Whenever"), createScoreLevel("Now")],
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
    state:
      "input" in input.state
        ? { kind: "input", input: input.state.input }
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

  it("passes a state that is only one variable as that input", () => {
    expect(
      toDecisionVersionInput({
        instance: makeInstance(makeDraft("{ticket}")),
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

  it("round-trips an input state in either template format", () => {
    for (const [format, state] of [
      [mustache, "{{ticket}}"],
      [fString, "{ticket}"],
    ] as const) {
      const draft = makeDraft(state);
      const saved = toSavedVersion(
        toDecisionVersionInput({
          instance: makeInstance(draft),
          templateFormat: format,
        })
      );

      expect(saved.state).toEqual({ kind: "input", input: "ticket" });
      expect(
        savedDecisionVersionToDraft({ version: saved, templateFormat: format })
          .state
      ).toBe(state);
    }
  });

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
      type: "noul",
      noul: { trueDescription: "", falseDescription: "" },
    });
    expect(loaded.questions[1]).toMatchObject({
      type: "choice",
      choices: [{ value: "billing", description: "" }],
    });
  });

  it("refuses an object state, which the editor has no form for", () => {
    expect(() =>
      savedDecisionVersionToDraft({
        version: { state: { kind: "object" }, questions: [] },
        templateFormat: mustache,
      })
    ).toThrow("object of its inputs");
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

  it("refuses an input state when the page has no template format to write it in", () => {
    expect(() =>
      savedDecisionVersionToDraft({
        version: { state: { kind: "input", input: "ticket" }, questions: [] },
        templateFormat: TemplateFormats.NONE,
      })
    ).toThrow("Switch the template format");
  });
});
