import {
  decisionVersionToText,
  type DecisionVersionDefinition,
} from "../decisionVersionUtils";

describe("decision definition comparison", () => {
  const version: DecisionVersionDefinition = {
    inputs: [{ name: "ticket" }],
    state: { __typename: "DecisionInputState", input: "ticket" },
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
          state: { __typename: "DecisionObjectState", object: true },
        })
      ).state
    ).toEqual({ object: true });
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
