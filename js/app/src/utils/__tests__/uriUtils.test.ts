import { describe, expect, it } from "vitest";

import { transformURISafeInput, trimURISafeSeparators } from "../uriUtils";

describe("transformURISafeInput", () => {
  it("converts whitespace to dashes and removes unsupported characters", () => {
    expect(transformURISafeInput("My Project.v2 / test")).toBe(
      "My-Project.v2-test"
    );
  });

  it("preserves valid separators and letter case", () => {
    expect(transformURISafeInput("My_Project-v2.test")).toBe(
      "My_Project-v2.test"
    );
  });

  it("drops leading separators but keeps trailing ones while typing", () => {
    expect(transformURISafeInput(" -._My Project ")).toBe("My-Project-");
  });

  it("folds accented letters", () => {
    expect(transformURISafeInput("Café Crème")).toBe("Cafe-Creme");
  });
});

describe("trimURISafeSeparators", () => {
  it("removes leading and trailing separators", () => {
    expect(trimURISafeSeparators("-.My-Project_.")).toBe("My-Project");
  });
});
