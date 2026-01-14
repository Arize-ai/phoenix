import { TemplateFormats } from "../constants";
import { isTemplateFormat, TemplateFormat } from "../types";

describe("TemplateFormat types", () => {
  describe("isTemplateFormat", () => {
    it("should return true for valid template formats", () => {
      expect(isTemplateFormat("NONE")).toBe(true);
      expect(isTemplateFormat("F_STRING")).toBe(true);
      expect(isTemplateFormat("MUSTACHE")).toBe(true);
      expect(isTemplateFormat("JSON_PATH")).toBe(true);
    });

    it("should return false for invalid template formats", () => {
      expect(isTemplateFormat("INVALID")).toBe(false);
      expect(isTemplateFormat("")).toBe(false);
      expect(isTemplateFormat("json_path")).toBe(false); // lowercase
      expect(isTemplateFormat("fstring")).toBe(false);
    });

    it("should accept all values from TemplateFormats constant", () => {
      Object.values(TemplateFormats).forEach((format) => {
        expect(isTemplateFormat(format)).toBe(true);
      });
    });
  });

  describe("TemplateFormat type", () => {
    it("should include JSON_PATH as a valid type", () => {
      const format: TemplateFormat = "JSON_PATH";
      expect(format).toBe("JSON_PATH");
    });

    it("should include all format types", () => {
      const formats: TemplateFormat[] = [
        "NONE",
        "F_STRING",
        "MUSTACHE",
        "JSON_PATH",
      ];
      formats.forEach((format) => {
        expect(isTemplateFormat(format)).toBe(true);
      });
    });
  });
});
