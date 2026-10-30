import {
  decisionVersionToText,
  type DecisionVersionDefinition,
} from "../decisionVersionUtils";

describe("decision definition comparison", () => {
  const version: DecisionVersionDefinition = {
    templateFormat: "MUSTACHE",
    state: { __typename: "DecisionJsonState", json: "{{ticket}}" },
    questions: [
      {
        __typename: "DecisionPredicateQuestion",
        name: "urgent",
        instructions: "Is it urgent?",
      },
    ],
    modelName: "tev1",
    modelProvider: "TYPESAFE",
    customProvider: null,
  };
  it("ignores record identity and Relay typenames", () => {
    expect(
      decisionVersionToText({
        ...version,
        ...{ id: "version-1", createdAt: "yesterday", tags: ["production"] },
      })
    ).toBe(
      decisionVersionToText({
        ...version,
        ...{ id: "version-2", createdAt: "today", tags: [] },
      })
    );
    expect(decisionVersionToText(version)).not.toContain("__typename");
    expect(
      JSON.parse(
        decisionVersionToText({
          ...version,
          state: { __typename: "DecisionJsonState", json: "{{state}}" },
        })
      ).state
    ).toEqual({ json: "{{state}}" });
  });
  it("includes question content, model, and provider routing changes", () => {
    for (const changed of [
      {
        ...version,
        questions: [
          { name: "urgent", instructions: "Does it need immediate action?" },
        ],
      },
      { ...version, modelName: "tev2" },
      { ...version, customProvider: { id: "provider-1", name: "proxy" } },
    ])
      expect(decisionVersionToText(changed)).not.toBe(
        decisionVersionToText(version)
      );
  });
});
