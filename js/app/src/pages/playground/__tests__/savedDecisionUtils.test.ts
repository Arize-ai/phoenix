import { describe, expect, it } from "vitest";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { DEFAULT_INSTANCE_PARAMS } from "@phoenix/store/playground";
import type {
  DecisionPromptDraft,
  DecisionStateDraft,
} from "@phoenix/store/playground/types";

import {
  createChoiceOption,
  createDecisionQuestion,
  createDecisionStateDraft,
  createScaleLevel,
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

/** A draft over this text template, or this JSON template when given a state. */
function makeDraft(state: string | DecisionStateDraft): DecisionPromptDraft {
  return {
    state:
      typeof state === "string"
        ? createDecisionStateDraft({ text: state })
        : state,
    questions: [
      createDecisionQuestion({
        type: "predicate",
        name: "is_refund",
        instructions: "Is this a refund request for {{plan}}?",
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

function makeInstance(draft: DecisionPromptDraft | null) {
  return {
    decisionPrompt: draft,
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
    templateFormat: input.templateFormat,
    state:
      "text" in input.state
        ? { kind: "text", text: input.state.text }
        : { kind: "json", json: input.state.json },
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
function withoutIds(draft: DecisionPromptDraft) {
  return {
    ...draft,
    questions: draft.questions.map(({ id: _id, choices, levels, ...rest }) => ({
      ...rest,
      choices: choices.map(({ id: _choiceId, ...choice }) => choice),
      levels: levels.map(({ id: _levelId, ...level }) => level),
    })),
  };
}

const jsonState = createDecisionStateDraft({
  mode: "json",
  json: '{"ticket": "{ticket}", "since": "Customer since {since}", "n": 2}',
});

describe("toDecisionVersionInput", () => {
  it("saves the template format, the state template and the questions, with the model that answers", () => {
    const input = toDecisionVersionInput({
      instance: makeInstance(makeDraft("Ticket: {{ticket}}")),
      templateFormat: mustache,
      description: "  first cut  ",
    });

    expect(input).toMatchObject({
      templateFormat: "MUSTACHE",
      state: { text: "Ticket: {{ticket}}" },
      modelProvider: "OLLAMA",
      // Trimmed, like the run input.
      modelName: "tev1:0.8b-mxfp8",
      customProviderId: null,
      description: "first cut",
    });
    expect(input).not.toHaveProperty("inputs");
    expect(input.questions).toHaveLength(3);
    expect(input.questions[0]).toEqual({
      predicate: {
        name: "is_refund",
        instructions: "Is this a refund request for {{plan}}?",
        criteria: { true: "Asks for money back", false: null },
      },
    });
  });

  it("saves a JSON state as the JSON value it is", () => {
    expect(
      toDecisionVersionInput({
        instance: makeInstance(makeDraft(jsonState)),
        templateFormat: fString,
      })
    ).toMatchObject({
      templateFormat: "F_STRING",
      state: {
        json: { ticket: "{ticket}", since: "Customer since {since}", n: 2 },
      },
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
        purpose: "test",
      })
    ).toThrow("Pick a decision model to test.");
    expect(() =>
      toDecisionVersionInput({
        instance: makeInstance(
          makeDraft(createDecisionStateDraft({ mode: "json", json: "{oops" }))
        ),
        templateFormat: mustache,
      })
    ).toThrow("not valid JSON");
    expect(() =>
      toDecisionVersionInput({
        instance: makeInstance(
          makeDraft(createDecisionStateDraft({ mode: "json", json: "3" }))
        ),
        templateFormat: mustache,
      })
    ).toThrow("must be an object, a list, or a string");
  });

  it("saves a state with no variables: every call sends it as written", () => {
    expect(
      toDecisionVersionInput({
        instance: makeInstance(makeDraft("no variables here")),
        templateFormat: TemplateFormats.NONE,
      })
    ).toMatchObject({
      templateFormat: "NONE",
      state: { text: "no variables here" },
    });
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

  it("round-trips a JSON state as JSON, written out", () => {
    const saved = toSavedVersion(
      toDecisionVersionInput({
        instance: makeInstance(makeDraft(jsonState)),
        templateFormat: fString,
      })
    );
    const loaded = savedDecisionVersionToDraft({
      version: saved,
      templateFormat: fString,
    });
    expect(loaded.state).toEqual({
      mode: "json",
      text: "",
      json: JSON.stringify(
        { ticket: "{ticket}", since: "Customer since {since}", n: 2 },
        null,
        2
      ),
    });
  });

  it("reads a predicate without criteria and a choice without descriptions", () => {
    const loaded = savedDecisionVersionToDraft({
      version: {
        templateFormat: mustache,
        state: { kind: "json", json: "{{ticket}}" },
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

  it("refuses a version written in another template format", () => {
    expect(() =>
      savedDecisionVersionToDraft({
        version: {
          templateFormat: fString,
          state: { kind: "text", text: "{ticket}" },
          questions: [],
        },
        templateFormat: mustache,
      })
    ).toThrow("written in F-String. Switch the template format to load it.");
  });
});
