/**
 * This test demonstrates the bug with react-hook-form when using field names
 * that contain dots. React-hook-form interprets dots as nested object paths,
 * so `pathMapping.output.available_tools` becomes:
 *   { pathMapping: { output: { available_tools: "value" } } }
 * Instead of:
 *   { pathMapping: { "output.available_tools": "value" } }
 *
 * The fix is to escape dots in the key when constructing react-hook-form field names.
 * We use URL-encoding style escaping (. -> %2E, % -> %25) to handle edge cases
 * where the escape sequence itself might appear in the original field name.
 */

import {
  escapeFieldNameForReactHookForm,
  unescapeFieldNameFromReactHookForm,
} from "../fieldNameUtils";

describe("fieldNameUtils", () => {
  describe("escapeFieldNameForReactHookForm", () => {
    it("escapes dots in field names", () => {
      expect(escapeFieldNameForReactHookForm("output.available_tools")).toBe(
        "output%2Eavailable_tools"
      );
    });

    it("escapes multiple dots", () => {
      expect(escapeFieldNameForReactHookForm("a.b.c.d")).toBe("a%2Eb%2Ec%2Ed");
    });

    it("leaves names without dots or percent signs unchanged", () => {
      expect(escapeFieldNameForReactHookForm("simple_name")).toBe(
        "simple_name"
      );
    });

    it("handles empty string", () => {
      expect(escapeFieldNameForReactHookForm("")).toBe("");
    });

    it("escapes percent signs to prevent conflicts with escape sequence", () => {
      expect(escapeFieldNameForReactHookForm("foo%bar")).toBe("foo%25bar");
    });

    it("handles field names that contain the escape sequence itself", () => {
      // If someone has a literal %2E in their field name, it should be preserved
      expect(escapeFieldNameForReactHookForm("foo%2Ebar")).toBe("foo%252Ebar");
    });

    it("handles field names with both dots and percent signs", () => {
      expect(escapeFieldNameForReactHookForm("foo.bar%baz")).toBe(
        "foo%2Ebar%25baz"
      );
    });
  });

  describe("unescapeFieldNameFromReactHookForm", () => {
    it("unescapes escaped dots", () => {
      expect(
        unescapeFieldNameFromReactHookForm("output%2Eavailable_tools")
      ).toBe("output.available_tools");
    });

    it("unescapes multiple escaped dots", () => {
      expect(unescapeFieldNameFromReactHookForm("a%2Eb%2Ec%2Ed")).toBe(
        "a.b.c.d"
      );
    });

    it("leaves names without escape sequences unchanged", () => {
      expect(unescapeFieldNameFromReactHookForm("simple_name")).toBe(
        "simple_name"
      );
    });

    it("handles empty string", () => {
      expect(unescapeFieldNameFromReactHookForm("")).toBe("");
    });

    it("unescapes percent signs", () => {
      expect(unescapeFieldNameFromReactHookForm("foo%25bar")).toBe("foo%bar");
    });

    it("correctly restores literal %2E that was in the original", () => {
      // %252E should become %2E (the original literal value)
      expect(unescapeFieldNameFromReactHookForm("foo%252Ebar")).toBe(
        "foo%2Ebar"
      );
    });
  });

  describe("round-trip escaping", () => {
    const testCases = [
      "simple",
      "output.value",
      "deeply.nested.path",
      "multiple.dots.in.name",
      "no_dots_here",
      "output.available_tools",
      "",
      // Edge cases with percent signs
      "foo%bar",
      "foo%2Ebar", // literal %2E in original
      "foo%25bar", // literal %25 in original
      "100%",
      "a.b%c.d",
      "%2E", // just the escape sequence
      "%25", // just the percent escape
      "%%%", // multiple percent signs
      ".%.", // dot, percent, dot
    ];

    test.each(testCases)("escaping and unescaping '%s' is identity", (key) => {
      const escaped = escapeFieldNameForReactHookForm(key);
      const unescaped = unescapeFieldNameFromReactHookForm(escaped);
      expect(unescaped).toBe(key);
    });

    test.each(testCases.filter((k) => k.includes(".")))(
      "escaped key '%s' does not contain dots",
      (key) => {
        const escaped = escapeFieldNameForReactHookForm(key);
        expect(escaped).not.toContain(".");
      }
    );
  });

  describe("edge case: escape sequence collision prevention", () => {
    it("handles the case where user has ___DOT___ in their variable name (old escape sequence)", () => {
      // This was the original escape sequence - make sure it doesn't cause issues
      const input = "foo___DOT___bar";
      const escaped = escapeFieldNameForReactHookForm(input);
      const unescaped = unescapeFieldNameFromReactHookForm(escaped);
      expect(unescaped).toBe(input);
    });

    it("handles complex combinations", () => {
      // A very adversarial input
      const input = "foo.%2E.%25.bar";
      const escaped = escapeFieldNameForReactHookForm(input);
      const unescaped = unescapeFieldNameFromReactHookForm(escaped);
      expect(unescaped).toBe(input);
    });
  });
});
