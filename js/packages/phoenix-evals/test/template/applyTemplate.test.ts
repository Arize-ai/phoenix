import { describe, it, expect } from "vitest";
import { formatTemplate } from "../../src/template/applyTemplate";

describe("formatTemplate", () => {
  it("should render template with multiple variables", () => {
    const result = formatTemplate({
      template: "Hello {{name}}, you are {{age}} years old from {{city}}.",
      variables: { name: "Alice", age: 30, city: "New York" },
    });

    expect(result).toBe("Hello Alice, you are 30 years old from New York.");
  });

  it("should handle nested object variables", () => {
    const result = formatTemplate({
      template: "Hello {{user.name}}, your email is {{user.email}}.",
      variables: {
        user: {
          name: "Bob",
          email: "bob@example.com",
        },
      },
    });

    expect(result).toBe("Hello Bob, your email is bob@example.com.");
  });

  it("should handle array variables with dot notation", () => {
    const result = formatTemplate({
      template: "First item: {{items.0}}, Second item: {{items.1}}",
      variables: { items: ["apple", "banana", "cherry"] },
    });

    expect(result).toBe("First item: apple, Second item: banana");
  });

  it("should handle boolean variables", () => {
    const result = formatTemplate({
      template: "Is active: {{isActive}}, Is verified: {{isVerified}}",
      variables: { isActive: true, isVerified: false },
    });

    expect(result).toBe("Is active: true, Is verified: false");
  });

  it("should handle numeric variables", () => {
    const result = formatTemplate({
      template: "Price: ${{price}}, Quantity: {{quantity}}",
      variables: { price: 19.99, quantity: 5 },
    });

    expect(result).toBe("Price: $19.99, Quantity: 5");
  });

  it("should render empty string for missing variables", () => {
    const result = formatTemplate({
      template: "Hello {{name}}, welcome to {{place}}!",
      variables: { name: "Alice" },
    });

    expect(result).toBe("Hello Alice, welcome to !");
  });

  it("should handle templates with no variables", () => {
    const result = formatTemplate({
      template: "This is a static template with no variables.",
      variables: {},
    });

    expect(result).toBe("This is a static template with no variables.");
  });

  it("should handle empty template", () => {
    const result = formatTemplate({
      template: "",
      variables: { name: "Alice" },
    });

    expect(result).toBe("");
  });

  it("should handle template with only variables", () => {
    const result = formatTemplate({
      template: "{{greeting}}",
      variables: { greeting: "Hello World" },
    });

    expect(result).toBe("Hello World");
  });

  it("should handle null and undefined variables", () => {
    const result = formatTemplate({
      template: "Value1: {{value1}}, Value2: {{value2}}",
      variables: { value1: null, value2: undefined },
    });

    expect(result).toBe("Value1: , Value2: ");
  });

  it("should handle mustache sections with arrays", () => {
    const result = formatTemplate({
      template: "Items: {{#items}}{{name}} {{/items}}",
      variables: {
        items: [{ name: "Apple" }, { name: "Banana" }, { name: "Cherry" }],
      },
    });

    expect(result).toBe("Items: Apple Banana Cherry ");
  });
});
