import { describe, expect, it } from "vitest";

import { validateIdentifier } from "../identifierUtils";

describe("validateIdentifier", () => {
  describe("valid identifiers", () => {
    it("should accept a simple lowercase identifier", () => {
      expect(validateIdentifier("myidentifier")).toBe(true);
    });
    it("should accept an identifier with numbers", () => {
      expect(validateIdentifier("identifier123")).toBe(true);
    });
    it("should accept an identifier starting with a number", () => {
      expect(validateIdentifier("123identifier")).toBe(true);
    });
    it("should accept an identifier with dashes in the middle", () => {
      expect(validateIdentifier("my-identifier")).toBe(true);
    });
    it("should accept an identifier with underscores in the middle", () => {
      expect(validateIdentifier("my_identifier")).toBe(true);
    });
    it("should accept an identifier with mixed separators", () => {
      expect(validateIdentifier("my-identifier_123")).toBe(true);
    });
    it("should accept a single lowercase letter", () => {
      expect(validateIdentifier("a")).toBe(true);
    });
    it("should accept a single number", () => {
      expect(validateIdentifier("1")).toBe(true);
    });
    it("should accept an empty string", () => {
      expect(validateIdentifier("")).toBe(true);
    }); // forms are expected to handle empty strings separately
  });

  describe("invalid identifiers - disallowed characters", () => {
    it("should reject an identifier with uppercase letters", () => {
      expect(validateIdentifier("MyIdentifier")).toBe(
        "Must have only lowercase alphanumeric characters, dashes, and underscores"
      );
    });
    it("should reject an identifier with spaces", () => {
      expect(validateIdentifier("my identifier")).toBe(
        "Must have only lowercase alphanumeric characters, dashes, and underscores"
      );
    });
    it("should reject an identifier with special characters", () => {
      expect(validateIdentifier("my@identifier")).toBe(
        "Must have only lowercase alphanumeric characters, dashes, and underscores"
      );
    });
    it("should reject an identifier with periods", () => {
      expect(validateIdentifier("my.identifier")).toBe(
        "Must have only lowercase alphanumeric characters, dashes, and underscores"
      );
    });
    it("should reject an identifier with slashes", () => {
      expect(validateIdentifier("my/identifier")).toBe(
        "Must have only lowercase alphanumeric characters, dashes, and underscores"
      );
    });
  });

  describe("invalid identifiers - start/end constraints", () => {
    it("should reject an identifier starting with a dash", () => {
      expect(validateIdentifier("-myidentifier")).toBe(
        "Must start and end with lowercase alphanumeric characters"
      );
    });
    it("should reject an identifier ending with a dash", () => {
      expect(validateIdentifier("myidentifier-")).toBe(
        "Must start and end with lowercase alphanumeric characters"
      );
    });
    it("should reject an identifier starting with an underscore", () => {
      expect(validateIdentifier("_myidentifier")).toBe(
        "Must start and end with lowercase alphanumeric characters"
      );
    });
    it("should reject an identifier ending with an underscore", () => {
      expect(validateIdentifier("myidentifier_")).toBe(
        "Must start and end with lowercase alphanumeric characters"
      );
    });
    it("should reject a single dash", () => {
      expect(validateIdentifier("-")).toBe(
        "Must start and end with lowercase alphanumeric characters"
      );
    });
    it("should reject a single underscore", () => {
      expect(validateIdentifier("_")).toBe(
        "Must start and end with lowercase alphanumeric characters"
      );
    });
    it("should reject multiple dashes", () => {
      expect(validateIdentifier("---")).toBe(
        "Must start and end with lowercase alphanumeric characters"
      );
    });
    it("should reject an identifier with trailing whitespace", () => {
      expect(validateIdentifier("myidentifier ")).toBe(
        "Must have only lowercase alphanumeric characters, dashes, and underscores"
      );
    });
    it("should reject an identifier with leading whitespace", () => {
      expect(validateIdentifier(" myidentifier")).toBe(
        "Must have only lowercase alphanumeric characters, dashes, and underscores"
      );
    });
  });
});
