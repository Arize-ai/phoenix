import { TemplateFormats } from "../constants";
import { getTemplateFormatUtils } from "../templateEditorUtils";

describe("templateEditorUtils", () => {
  describe("getTemplateFormatUtils", () => {
    describe("JSON_PATH format", () => {
      const utils = getTemplateFormatUtils(TemplateFormats.JSONPath);

      it("should extract variables from JSON_PATH template", () => {
        expect(utils.extractVariables("{$.name}")).toEqual(["$.name"]);
        expect(utils.extractVariables("{$.name} {$.age}")).toEqual([
          "$.name",
          "$.age",
        ]);
        expect(utils.extractVariables("{$.nested.path}")).toEqual([
          "$.nested.path",
        ]);
        expect(utils.extractVariables("{$.array[0]}")).toEqual(["$.array[0]"]);
        expect(utils.extractVariables("{$.deep[0].nested}")).toEqual([
          "$.deep[0].nested",
        ]);
      });

      it("should handle escaped braces in extraction", () => {
        expect(utils.extractVariables("\\{$.name}")).toEqual([]);
        expect(utils.extractVariables("{$.name} \\{$.age}")).toEqual([
          "$.name",
        ]);
      });

      it("should format JSON_PATH template with variables", () => {
        expect(
          utils.format({
            text: "{$.name}",
            variables: { "$.name": "John" },
          })
        ).toBe("John");

        expect(
          utils.format({
            text: "{$.name} {$.age}",
            variables: { "$.name": "John", "$.age": 30 },
          })
        ).toBe("John 30");

        expect(
          utils.format({
            text: "{$.nested.path}",
            variables: { "$.nested.path": "value" },
          })
        ).toBe("value");
      });

      it("should leave unmatched paths as-is", () => {
        expect(
          utils.format({
            text: "{$.name} {$.city}",
            variables: { "$.name": "John" },
          })
        ).toBe("John {$.city}");
      });

      it("should handle escaped braces in formatting", () => {
        expect(
          utils.format({
            text: "\\{$.name} {$.age}",
            variables: { "$.name": "John", "$.age": 30 },
          })
        ).toBe("{$.name} 30");
      });
    });

    describe("F_STRING format", () => {
      const utils = getTemplateFormatUtils(TemplateFormats.FString);

      it("should extract variables from F_STRING template", () => {
        expect(utils.extractVariables("{name}")).toEqual(["name"]);
        expect(utils.extractVariables("{name} {age}")).toEqual(["name", "age"]);
      });

      it("should format F_STRING template with variables", () => {
        expect(
          utils.format({
            text: "{name}",
            variables: { name: "John" },
          })
        ).toBe("John");
      });
    });

    describe("MUSTACHE format", () => {
      const utils = getTemplateFormatUtils(TemplateFormats.Mustache);

      it("should extract variables from MUSTACHE template", () => {
        expect(utils.extractVariables("{{name}}")).toEqual(["name"]);
        expect(utils.extractVariables("{{name}} {{age}}")).toEqual([
          "name",
          "age",
        ]);
      });

      it("should format MUSTACHE template with variables", () => {
        expect(
          utils.format({
            text: "{{name}}",
            variables: { name: "John" },
          })
        ).toBe("John");
      });
    });

    describe("NONE format", () => {
      const utils = getTemplateFormatUtils(TemplateFormats.NONE);

      it("should return empty array for variable extraction", () => {
        expect(utils.extractVariables("{name}")).toEqual([]);
        expect(utils.extractVariables("{{name}}")).toEqual([]);
        expect(utils.extractVariables("{$.name}")).toEqual([]);
      });

      it("should return text as-is for formatting", () => {
        expect(
          utils.format({
            text: "Hello {name}",
            variables: { name: "John" },
          })
        ).toBe("Hello {name}");
      });
    });
  });
});
