import { JSONPathTemplating, PathAutocompleteOption } from "../jsonPath";

describe("JSONPath autocomplete", () => {
  const createAutocompleteOptions = (): PathAutocompleteOption[] => [
    { id: "$.name", label: "$.name" },
    { id: "$.age", label: "$.age" },
    { id: "$.address.city", label: "$.address.city" },
    { id: "$.address.street", label: "$.address.street" },
    { id: "$.items[0]", label: "$.items[0]" },
    { id: "$.items[0].name", label: "$.items[0].name" },
  ];

  it("should create extension with autocomplete options", () => {
    const pathOptions = createAutocompleteOptions();
    const extension = JSONPathTemplating({ pathOptions });

    // Extension should be created successfully
    expect(extension).toBeDefined();
    expect(extension.extension).toBeDefined();
  });

  it("should create extension without autocomplete options", () => {
    const extension = JSONPathTemplating();

    // Extension should work fine without autocomplete
    expect(extension).toBeDefined();
    expect(extension.extension).toBeDefined();
  });

  it("should create extension with empty autocomplete options", () => {
    const extension = JSONPathTemplating({ pathOptions: [] });

    // Extension should work fine with empty array
    expect(extension).toBeDefined();
    expect(extension.extension).toBeDefined();
  });
});
