import { getTemplateVariables } from "../../src/template/getTemplateVariables";

import { describe, expect, it } from "vitest";

describe("getTemplateVariables", () => {
  it("should parse out the variables of a template", () => {
    const variables = getTemplateVariables({ template: "{{hello}} {{world}}" });
    expect(variables).toEqual(["hello", "world"]);
  });
});
