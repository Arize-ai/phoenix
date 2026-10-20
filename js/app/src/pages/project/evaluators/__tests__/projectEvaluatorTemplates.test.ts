import { DEFAULT_SPAN_FILTER_CONDITION } from "@phoenix/pages/project/spanFilterRootScopeConstants";

import {
  getProjectEvaluatorTemplateDefaults,
  getProjectEvaluatorTemplatePathMapping,
} from "../projectEvaluatorTemplates";

describe("getProjectEvaluatorTemplatePathMapping", () => {
  it("keeps a string-to-string record", () => {
    expect(
      getProjectEvaluatorTemplatePathMapping({
        defaultPathMapping: { input: "input.messages", tools: "input.tools" },
      })
    ).toEqual({ input: "input.messages", tools: "input.tools" });
  });

  it.each([null, undefined, "input.messages", ["input"], { input: 1 }])(
    "ignores %p",
    (defaultPathMapping) => {
      expect(
        getProjectEvaluatorTemplatePathMapping({ defaultPathMapping })
      ).toEqual({});
    }
  );
});

describe("getProjectEvaluatorTemplateDefaults", () => {
  it("opens on the template's scope with its own filter and mapping", () => {
    expect(
      getProjectEvaluatorTemplateDefaults({
        scope: "SESSION",
        defaultFilterCondition: "num_traces > 1",
        defaultPathMapping: {
          conversation: "metadata.turns[:-1]",
          user_message: "metadata.turns[-1].input",
        },
      })
    ).toEqual({
      targetType: "SESSION",
      filterCondition: "num_traces > 1",
      inputMapping: {
        pathMapping: {
          conversation: "metadata.turns[:-1]",
          user_message: "metadata.turns[-1].input",
        },
        literalMapping: {},
      },
    });
  });

  it("falls back to the target's default filter and an empty mapping", () => {
    expect(
      getProjectEvaluatorTemplateDefaults({
        scope: "SPAN",
        defaultFilterCondition: null,
        defaultPathMapping: null,
      })
    ).toEqual({
      targetType: "SPAN",
      filterCondition: DEFAULT_SPAN_FILTER_CONDITION,
      inputMapping: { pathMapping: {}, literalMapping: {} },
    });
  });

  it("treats a missing scope as spans", () => {
    expect(
      getProjectEvaluatorTemplateDefaults({
        scope: null,
        defaultFilterCondition: null,
        defaultPathMapping: null,
      }).targetType
    ).toBe("SPAN");
  });
});
