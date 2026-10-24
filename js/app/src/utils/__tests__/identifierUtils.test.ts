import { describe, expect, it } from "vitest";

import {
  replaceWhitespaceWithDashes,
  transformIdentifierInput,
  validateIdentifier,
} from "../identifierUtils";

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
  });

  describe("invalid identifiers - empty", () => {
    it("should reject an empty string", () => {
      expect(validateIdentifier("")).toBe("Cannot be empty");
    });
    it("should reject a string with only spaces", () => {
      expect(validateIdentifier("   ")).toBe("Cannot be empty");
    });
    it("should reject a string with tabs and newlines", () => {
      expect(validateIdentifier("\t \n")).toBe("Cannot be empty");
    });
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

describe("replaceWhitespaceWithDashes", () => {
  it("should replace a single space with a dash", () => {
    expect(replaceWhitespaceWithDashes("my identifier")).toBe("my-identifier");
  });
  it("should collapse multiple consecutive spaces into one dash", () => {
    expect(replaceWhitespaceWithDashes("my   identifier")).toBe(
      "my-identifier"
    );
  });
  it("should replace tabs and newlines from pasted text", () => {
    expect(replaceWhitespaceWithDashes("my\tpasted\n identifier")).toBe(
      "my-pasted-identifier"
    );
  });
  it("should keep leading and trailing whitespace as dashes", () => {
    expect(replaceWhitespaceWithDashes(" my identifier ")).toBe(
      "-my-identifier-"
    );
  });
  it("should leave other disallowed characters for validation to flag", () => {
    expect(replaceWhitespaceWithDashes("my+identifier")).toBe("my+identifier");
    expect(replaceWhitespaceWithDashes("My Identifier")).toBe("My-Identifier");
  });
  it("should leave a valid identifier unchanged", () => {
    expect(replaceWhitespaceWithDashes("my-identifier_1")).toBe(
      "my-identifier_1"
    );
  });
});

describe("transformIdentifierInput", () => {
  it("should replace a single space with a dash", () => {
    expect(transformIdentifierInput("my identifier")).toBe("my-identifier");
  });
  it("should collapse multiple consecutive spaces into one dash", () => {
    expect(transformIdentifierInput("my   identifier")).toBe("my-identifier");
  });
  it("should replace tabs and newlines from pasted text", () => {
    expect(transformIdentifierInput("my\tpasted\n identifier")).toBe(
      "my-pasted-identifier"
    );
  });
  it("should keep a trailing dash so the user can keep typing", () => {
    expect(transformIdentifierInput("my ")).toBe("my-");
  });
  it("should lowercase and strip disallowed characters", () => {
    expect(transformIdentifierInput("My+Identifier!")).toBe("myidentifier");
  });
});
