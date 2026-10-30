import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  azureChatBaseUrl,
  type DecisionSDK,
  decisionEndpointUrl,
  guessDecisionBaseUrl,
} from "../decisionEndpoints";

/** The server's cases, so the form previews the URL a run calls. */
const CASES_PATH = resolve(
  __dirname,
  "../../../../../../tests/unit/server/decisions/decision_endpoint_cases.json"
);

type Case = {
  decisionSdk: "openai" | "typesafe";
  baseUrl: string;
  url: string;
};
type GuessCase = {
  decisionSdk: "openai" | "typesafe";
  chatBaseUrl: string | null;
  baseUrl: string;
};

const { endpointUrl, guessBaseUrl } = JSON.parse(
  readFileSync(CASES_PATH, "utf-8")
) as { endpointUrl: Case[]; guessBaseUrl: GuessCase[] };

function toDecisionSdk(value: Case["decisionSdk"]): DecisionSDK {
  return value === "openai" ? "OPENAI" : "TYPESAFE";
}

describe("decisionEndpointUrl", () => {
  it.each(endpointUrl)(
    "$decisionSdk at $baseUrl posts to $url",
    ({ decisionSdk, baseUrl, url }) => {
      expect(decisionEndpointUrl(toDecisionSdk(decisionSdk), baseUrl)).toBe(
        url
      );
    }
  );
});

describe("guessDecisionBaseUrl", () => {
  it.each(guessBaseUrl)(
    "$decisionSdk from $chatBaseUrl guesses $baseUrl",
    ({ decisionSdk, chatBaseUrl, baseUrl }) => {
      expect(
        guessDecisionBaseUrl(toDecisionSdk(decisionSdk), chatBaseUrl)
      ).toBe(baseUrl);
    }
  );
});

describe("azureChatBaseUrl", () => {
  it("resolves the v1 API as the server does", () => {
    expect(azureChatBaseUrl("https://res.openai.azure.com/")).toBe(
      "https://res.openai.azure.com/openai/v1"
    );
    expect(azureChatBaseUrl("https://res.openai.azure.com/openai/v1")).toBe(
      "https://res.openai.azure.com/openai/v1"
    );
    expect(azureChatBaseUrl("")).toBeNull();
  });
});
