import { describe, expect, it } from "vitest";

import { transformURISafeInput } from "../uriUtils";

describe("transformURISafeInput", () => {
  it("converts whitespace to dashes and removes unsupported characters", () => {
    expect(transformURISafeInput("My Project.v2 / test")).toBe(
      "My-Project.v2--test"
    );
  });

  it("preserves valid separators and letter case", () => {
    expect(transformURISafeInput("My_Project-v2.test")).toBe(
      "My_Project-v2.test"
    );
  });
});
