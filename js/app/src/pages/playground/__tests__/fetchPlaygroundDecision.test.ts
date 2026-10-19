import { describe, expect, it } from "vitest";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { DEFAULT_INSTANCE_PARAMS } from "@phoenix/store/playground";

import type { FetchedDecisionVersion } from "../fetchPlaygroundDecision";
import {
  getDecisionTemplateFormat,
  toDecisionInstance,
} from "../fetchPlaygroundDecision";

const fetched: FetchedDecisionVersion = {
  decision: { id: "D1", name: "triage", versionId: "DV1" },
  version: {
    state: {
      kind: "text",
      template: "Ticket: {{ticket}}",
      templateFormat: "MUSTACHE",
    },
    questions: [
      {
        kind: "choice",
        name: "team",
        instructions: "Which team?",
        choices: [{ value: "billing", description: null }],
      },
    ],
  },
  modelProvider: "OLLAMA",
  modelName: "tev1:0.8b-mxfp8",
  customProvider: null,
};

describe("toDecisionInstance", () => {
  it("is a decision task holding the version's request, model and saved reference", () => {
    const instance = toDecisionInstance({
      fetched,
      tagName: "prod",
      templateFormat: TemplateFormats.Mustache,
    });

    expect(instance.task).toEqual({ member: "decision" });
    expect(instance.decision).toEqual({
      id: "D1",
      name: "triage",
      versionId: "DV1",
      tag: "prod",
    });
    expect(instance.decisionRequest).toMatchObject({
      state: "Ticket: {{ticket}}",
      stateFormat: "text",
    });
    expect(instance.model).toMatchObject({
      provider: "OLLAMA",
      modelName: "tev1:0.8b-mxfp8",
      modelType: "DECISION",
      baseUrl: null,
    });
  });

  it("keeps the chat model the instance can switch back to, and its endpoint while the provider holds", () => {
    const chat = DEFAULT_INSTANCE_PARAMS().model;
    const base = {
      llmModel: chat,
      model: {
        provider: "OLLAMA" as const,
        modelName: "other",
        modelType: "DECISION" as const,
        invocationParameters: chat.invocationParameters,
        baseUrl: "http://localhost:11434/v1",
      },
    };

    const same = toDecisionInstance({
      fetched,
      tagName: null,
      templateFormat: TemplateFormats.Mustache,
      base,
    });

    expect(same.llmModel).toEqual(chat);
    expect(same.model.baseUrl).toBe("http://localhost:11434/v1");

    const moved = toDecisionInstance({
      fetched: { ...fetched, modelProvider: "TYPESAFE" },
      tagName: null,
      templateFormat: TemplateFormats.Mustache,
      base,
    });

    expect(moved.model.baseUrl).toBeNull();
  });

  it("takes a custom provider's routing from the provider, not the instance", () => {
    const instance = toDecisionInstance({
      fetched: {
        ...fetched,
        customProvider: { id: "CP1", name: "my-typesafe" },
      },
      tagName: null,
      templateFormat: TemplateFormats.Mustache,
    });

    expect(instance.model).toMatchObject({
      customProvider: { id: "CP1", name: "my-typesafe" },
      baseUrl: null,
    });
  });

  it("refuses a version the page's template format cannot express", () => {
    expect(() =>
      toDecisionInstance({
        fetched,
        tagName: null,
        templateFormat: TemplateFormats.FString,
      })
    ).toThrow("written in Mustache");
  });
});

describe("getDecisionTemplateFormat", () => {
  it("is the format a text state is written in, and none for an input state", () => {
    expect(getDecisionTemplateFormat(fetched)).toBe("MUSTACHE");
    expect(
      getDecisionTemplateFormat({
        version: {
          ...fetched.version,
          state: { kind: "text", template: "{a}", templateFormat: "F_STRING" },
        },
      })
    ).toBe("F_STRING");
    expect(
      getDecisionTemplateFormat({
        version: { ...fetched.version, state: { kind: "input", input: "a" } },
      })
    ).toBeNull();
  });
});
