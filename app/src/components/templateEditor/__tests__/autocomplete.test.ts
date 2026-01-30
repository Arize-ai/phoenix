import { describe, expect, it } from "vitest";

import {
  detectMustacheSectionContext,
  findIterableVariables,
  getPathsForSectionContext,
} from "../autocomplete";
import { TemplateFormats } from "../constants";

describe("findIterableVariables", () => {
  it("identifies variables with bracket notation as iterable", () => {
    const allPaths = [
      "messages",
      "messages[0]",
      "messages[0].role",
      "messages[0].content",
    ];
    const validPaths = ["messages"];

    const result = findIterableVariables(allPaths, validPaths);

    expect(result.has("messages")).toBe(true);
  });

  it("identifies variables with nested paths as iterable", () => {
    const allPaths = ["user", "user.name", "user.email"];
    const validPaths = ["user", "user.name", "user.email"];

    const result = findIterableVariables(allPaths, validPaths);

    expect(result.has("user")).toBe(true);
  });

  it("handles deeply nested paths", () => {
    const allPaths = [
      "input",
      "input.data",
      "input.data.items",
      "input.data.items[0]",
      "input.data.items[0].name",
    ];
    const validPaths = ["input", "input.data", "input.data.items"];

    const result = findIterableVariables(allPaths, validPaths);

    // findIterableVariables extracts first segment from dotted validPaths
    // and full path before bracket from allPaths
    expect(result.has("input")).toBe(true);
    expect(result.has("input.data.items")).toBe(true);
    // Note: input.data is identified because input.data.items has nested path
    // The function extracts the first dot segment, so "input" is found from "input.data"
  });

  it("returns empty set for flat paths", () => {
    const allPaths = ["name", "email", "age"];
    const validPaths = ["name", "email", "age"];

    const result = findIterableVariables(allPaths, validPaths);

    expect(result.size).toBe(0);
  });
});

describe("detectMustacheSectionContext", () => {
  it("returns empty array when not in a section", () => {
    const text = "Hello {{name}}";
    expect(detectMustacheSectionContext(text)).toEqual([]);
  });

  it("detects simple section context", () => {
    const text = "{{#items}}{{";
    expect(detectMustacheSectionContext(text)).toEqual(["items"]);
  });

  it("detects inverted section context", () => {
    const text = "{{^items}}{{";
    expect(detectMustacheSectionContext(text)).toEqual(["items"]);
  });

  it("returns empty when section is closed", () => {
    const text = "{{#items}}...{{/items}}{{";
    expect(detectMustacheSectionContext(text)).toEqual([]);
  });

  it("handles nested sections", () => {
    const text = "{{#outer}}{{#inner}}{{";
    expect(detectMustacheSectionContext(text)).toEqual(["outer", "inner"]);
  });

  it("handles partially closed nested sections", () => {
    const text = "{{#outer}}{{#inner}}...{{/inner}}{{";
    expect(detectMustacheSectionContext(text)).toEqual(["outer"]);
  });

  it("handles dotted section names", () => {
    const text = "{{#input.messages}}{{";
    expect(detectMustacheSectionContext(text)).toEqual(["input.messages"]);
  });

  it("handles deeply nested dotted section names", () => {
    const text = "{{#input.input.input.messages}}{{";
    expect(detectMustacheSectionContext(text)).toEqual([
      "input.input.input.messages",
    ]);
  });

  it("handles multiple sections at same level", () => {
    const text = "{{#first}}...{{/first}}{{#second}}{{";
    expect(detectMustacheSectionContext(text)).toEqual(["second"]);
  });
});

describe("getPathsForSectionContext", () => {
  it("extracts child paths from array bracket notation", () => {
    const allPaths = [
      "messages",
      "messages[0]",
      "messages[0].role",
      "messages[0].content",
      "messages[1]",
      "messages[1].role",
      "messages[1].content",
    ];

    const result = getPathsForSectionContext(allPaths, "messages");

    expect(result).toContain("role");
    expect(result).toContain("content");
    expect(result).not.toContain("messages");
    expect(result).not.toContain("messages[0]");
  });

  it("extracts child paths from dot notation", () => {
    const allPaths = ["user", "user.name", "user.email", "user.address"];

    const result = getPathsForSectionContext(allPaths, "user");

    expect(result).toContain("name");
    expect(result).toContain("email");
    expect(result).toContain("address");
    expect(result).not.toContain("user");
  });

  it("handles deeply nested paths", () => {
    const allPaths = [
      "items",
      "items[0]",
      "items[0].user",
      "items[0].user.name",
      "items[0].user.email",
    ];

    const result = getPathsForSectionContext(allPaths, "items");

    expect(result).toContain("user");
    expect(result).toContain("user.name");
    expect(result).toContain("user.email");
  });

  it("returns empty for non-matching section variable", () => {
    const allPaths = ["messages[0].role", "messages[0].content"];

    const result = getPathsForSectionContext(allPaths, "nonexistent");

    expect(result).toEqual([]);
  });

  it("handles deeply nested section variables", () => {
    const allPaths = [
      "input.input.input.messages",
      "input.input.input.messages[0]",
      "input.input.input.messages[0].role",
      "input.input.input.messages[0].content",
    ];

    const result = getPathsForSectionContext(
      allPaths,
      "input.input.input.messages"
    );

    expect(result).toContain("role");
    expect(result).toContain("content");
  });

  it("adds intermediate paths for nested child properties", () => {
    const allPaths = [
      "items[0].user.profile.name",
      "items[0].user.profile.avatar",
    ];

    const result = getPathsForSectionContext(allPaths, "items");

    expect(result).toContain("user");
    expect(result).toContain("user.profile");
    expect(result).toContain("user.profile.name");
    expect(result).toContain("user.profile.avatar");
  });

  it("extracts child paths including nested arrays", () => {
    const allPaths = [
      "items[0].tags",
      "items[0].tags[0]",
      "items[0].tags[1]",
      "items[0].name",
    ];

    const result = getPathsForSectionContext(allPaths, "items");

    expect(result).toContain("tags");
    expect(result).toContain("name");
    // Note: bracket notation IS extracted for array element access
    // The filtering of bracket paths happens at the autocomplete options level
    // for Mustache, not in getPathsForSectionContext
    expect(result).toContain("tags[0]");
    expect(result).toContain("tags[1]");
  });
});

describe("Template format differences", () => {
  describe("Mustache format", () => {
    it("uses double brackets", () => {
      // Mustache uses {{ and }}
      expect(TemplateFormats.Mustache).toBeDefined();
    });
  });

  describe("FString format", () => {
    it("uses single brackets", () => {
      // FString uses { and }
      expect(TemplateFormats.FString).toBeDefined();
    });
  });
});

describe("edge cases", () => {
  describe("special characters in paths", () => {
    it("handles paths with special regex characters", () => {
      // The escapeRegex function should handle special characters
      const allPaths = ["data.items[0].value"];

      const result = getPathsForSectionContext(allPaths, "data.items");

      expect(result).toContain("value");
    });
  });

  describe("empty inputs", () => {
    it("handles empty paths array", () => {
      const result = getPathsForSectionContext([], "items");
      expect(result).toEqual([]);
    });

    it("handles empty section variable", () => {
      const allPaths = ["items[0].name"];
      const result = getPathsForSectionContext(allPaths, "");
      // Empty section var won't match anything
      expect(result).toEqual([]);
    });

    it("findIterableVariables handles empty arrays", () => {
      const result = findIterableVariables([], []);
      expect(result.size).toBe(0);
    });

    it("detectMustacheSectionContext handles empty string", () => {
      const result = detectMustacheSectionContext("");
      expect(result).toEqual([]);
    });
  });

  describe("malformed section syntax", () => {
    it("ignores unclosed section tags", () => {
      // {{#items without closing }}
      const text = "{{#items";
      const result = detectMustacheSectionContext(text);
      expect(result).toEqual([]);
    });

    it("ignores malformed close tags", () => {
      const text = "{{#items}}{{/";
      const result = detectMustacheSectionContext(text);
      expect(result).toEqual(["items"]);
    });
  });

  describe("paths without templateVariablesPath scoping", () => {
    it("handles full context paths (Example root)", () => {
      // When templateVariablesPath is null, paths include input., reference., metadata.
      const allPaths = [
        "input",
        "input.query",
        "reference",
        "reference.label",
        "metadata",
        "metadata.source",
      ];

      const iterableVars = findIterableVariables(allPaths, allPaths);

      expect(iterableVars.has("input")).toBe(true);
      expect(iterableVars.has("reference")).toBe(true);
      expect(iterableVars.has("metadata")).toBe(true);
    });

    it("handles scoped paths (templateVariablesPath = 'input')", () => {
      // When templateVariablesPath is "input", paths are relative to input
      const allPaths = ["query", "messages", "messages[0]", "messages[0].role"];

      const iterableVars = findIterableVariables(allPaths, [
        "query",
        "messages",
      ]);

      expect(iterableVars.has("messages")).toBe(true);
      expect(iterableVars.has("query")).toBe(false); // No nested paths
    });
  });

  describe("complex nested structures", () => {
    it("handles arrays of arrays", () => {
      const allPaths = [
        "matrix",
        "matrix[0]",
        "matrix[0][0]",
        "matrix[0][1]",
        "matrix[1]",
        "matrix[1][0]",
      ];

      const iterableVars = findIterableVariables(allPaths, ["matrix"]);

      expect(iterableVars.has("matrix")).toBe(true);
    });

    it("handles mixed nested objects and arrays", () => {
      const allPaths = [
        "data",
        "data.users",
        "data.users[0]",
        "data.users[0].posts",
        "data.users[0].posts[0]",
        "data.users[0].posts[0].title",
      ];

      // Inside {{#data.users}} section
      const userPaths = getPathsForSectionContext(allPaths, "data.users");

      expect(userPaths).toContain("posts");
    });
  });
});
