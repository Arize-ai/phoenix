import {
  flattenObject,
  safelyParseJSONObjectString,
} from "@phoenix/utils/jsonUtils";

describe("useJSONPathAutocomplete logic", () => {
  it("should generate autocomplete options from JSON data", () => {
    const jsonData = JSON.stringify({
      name: "John",
      age: 30,
      address: {
        city: "New York",
        street: "Main St",
      },
    });

    const parsedData = safelyParseJSONObjectString(jsonData);
    expect(parsedData).toBeDefined();

    if (parsedData) {
      const flat = flattenObject({
        obj: parsedData,
        keepNonTerminalValues: true,
        formatIndices: true,
      });

      const options = Object.keys(flat).map((key) => ({
        id: `$.${key}`,
        label: `$.${key}`,
      }));

      expect(options).toContainEqual({ id: "$.name", label: "$.name" });
      expect(options).toContainEqual({ id: "$.age", label: "$.age" });
      expect(options).toContainEqual({
        id: "$.address.city",
        label: "$.address.city",
      });
      expect(options).toContainEqual({
        id: "$.address.street",
        label: "$.address.street",
      });
      // Non-terminal values should also be included
      expect(options).toContainEqual({ id: "$.address", label: "$.address" });
    }
  });

  it("should handle arrays with bracket notation", () => {
    const jsonData = JSON.stringify({
      items: [{ name: "Item 1" }, { name: "Item 2" }],
    });

    const parsedData = safelyParseJSONObjectString(jsonData);
    expect(parsedData).toBeDefined();

    if (parsedData) {
      const flat = flattenObject({
        obj: parsedData,
        keepNonTerminalValues: true,
        formatIndices: true,
      });

      const options = Object.keys(flat).map((key) => ({
        id: `$.${key}`,
        label: `$.${key}`,
      }));

      // Arrays should use bracket notation
      expect(options).toContainEqual({
        id: "$.items[0].name",
        label: "$.items[0].name",
      });
      expect(options).toContainEqual({
        id: "$.items[1].name",
        label: "$.items[1].name",
      });
    }
  });

  it("should return undefined for invalid JSON", () => {
    const parsedData = safelyParseJSONObjectString("invalid json");
    expect(parsedData).toBeUndefined();
  });

  it("should return empty object keys for empty JSON object", () => {
    const jsonData = "{}";
    const parsedData = safelyParseJSONObjectString(jsonData);
    expect(parsedData).toEqual({});

    if (parsedData) {
      const flat = flattenObject({
        obj: parsedData,
        keepNonTerminalValues: true,
        formatIndices: true,
      });
      expect(Object.keys(flat)).toEqual([]);
    }
  });
});
