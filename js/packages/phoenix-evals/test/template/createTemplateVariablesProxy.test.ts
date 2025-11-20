import { createTemplateVariablesProxy } from "../../src/template/createTemplateVariablesProxy";

import { describe, expect, it } from "vitest";

describe("createTemplateVariablesProxy", () => {
  it("should return null as-is", () => {
    const result = createTemplateVariablesProxy(null);
    expect(result).toBe(null);
  });

  it("should return undefined as-is", () => {
    const result = createTemplateVariablesProxy(undefined);
    expect(result).toBe(undefined);
  });

  it("should return primitives as-is", () => {
    expect(createTemplateVariablesProxy("string")).toBe("string");
    expect(createTemplateVariablesProxy(42)).toBe(42);
    expect(createTemplateVariablesProxy(true)).toBe(true);
    expect(createTemplateVariablesProxy(false)).toBe(false);
  });

  it("should wrap arrays and proxy their elements", () => {
    const arr = ["string", 42, { nested: "object" }, [{ deeply: "nested" }]];
    const proxied = createTemplateVariablesProxy(arr) as unknown[];

    expect(Array.isArray(proxied)).toBe(true);
    expect(proxied[0]).toBe("string");
    expect(proxied[1]).toBe(42);
    // Nested objects should be proxied
    expect(typeof proxied[2]).toBe("object");
    expect((proxied[2] as { toString(): string }).toString()).toBe(
      JSON.stringify({ nested: "object" })
    );
  });

  it("should stringify objects when toString() is called", () => {
    const obj = { name: "Alice", age: 30 };
    const proxied = createTemplateVariablesProxy(obj) as {
      toString(): string;
      name: string;
      age: number;
    };

    expect(proxied.toString()).toBe(JSON.stringify(obj));
  });

  it("should allow property access on proxied objects", () => {
    const obj = { name: "Alice", age: 30, city: "New York" };
    const proxied = createTemplateVariablesProxy(obj) as {
      name: string;
      age: number;
      city: string;
    };

    expect(proxied.name).toBe("Alice");
    expect(proxied.age).toBe(30);
    expect(proxied.city).toBe("New York");
  });

  it("should proxy nested objects", () => {
    const obj = {
      user: {
        name: "Bob",
        profile: {
          email: "bob@example.com",
          settings: { theme: "dark" },
        },
      },
    };
    const proxied = createTemplateVariablesProxy(obj) as {
      user: {
        name: string;
        profile: {
          toString(): string;
          email: string;
          settings: { toString(): string; theme: string };
        };
      };
    };

    // Top-level property access should work
    expect(proxied.user.name).toBe("Bob");

    // Nested object should be proxied and stringifiable
    expect(typeof proxied.user.profile).toBe("object");
    expect(proxied.user.profile.toString()).toBe(
      JSON.stringify({
        email: "bob@example.com",
        settings: { theme: "dark" },
      })
    );

    // But we can still access properties of nested objects
    expect(proxied.user.profile.email).toBe("bob@example.com");
    expect(proxied.user.profile.settings.toString()).toBe(
      JSON.stringify({ theme: "dark" })
    );
    expect(proxied.user.profile.settings.theme).toBe("dark");
  });

  it("should handle objects with null and undefined values", () => {
    const obj = {
      nullValue: null,
      undefinedValue: undefined,
      nested: { alsoNull: null },
    };
    const proxied = createTemplateVariablesProxy(obj) as {
      nullValue: null;
      undefinedValue: undefined;
      nested: { toString(): string; alsoNull: null };
    };

    expect(proxied.nullValue).toBe(null);
    expect(proxied.undefinedValue).toBe(undefined);
    expect(proxied.nested.alsoNull).toBe(null);
    expect(proxied.nested.toString()).toBe(JSON.stringify({ alsoNull: null }));
  });

  it("should handle objects with array properties", () => {
    const obj = {
      items: ["apple", "banana", "cherry"],
      nested: {
        tags: ["tag1", "tag2"],
      },
    };
    const proxied = createTemplateVariablesProxy(obj) as {
      items: string[];
      nested: { toString(): string; tags: string[] };
    };

    expect(Array.isArray(proxied.items)).toBe(true);
    expect(proxied.items[0]).toBe("apple");
    expect(Array.isArray(proxied.nested.tags)).toBe(true);
    expect(proxied.nested.tags[0]).toBe("tag1");
    expect(proxied.nested.toString()).toBe(
      JSON.stringify({ tags: ["tag1", "tag2"] })
    );
  });

  it("should handle empty objects", () => {
    const obj = {};
    const proxied = createTemplateVariablesProxy(obj) as { toString(): string };

    expect(proxied.toString()).toBe("{}");
    expect(Object.keys(proxied)).toEqual([]);
  });

  it("should handle objects with symbol keys", () => {
    const sym = Symbol("test");
    const obj = {
      [sym]: "symbol value",
      regular: "regular value",
    };
    const proxied = createTemplateVariablesProxy(obj) as {
      [sym]: string;
      regular: string;
      toString(): string;
    };

    expect(proxied[sym]).toBe("symbol value");
    expect(proxied.regular).toBe("regular value");
    // toString should only include enumerable string keys
    expect(proxied.toString()).toBe(
      JSON.stringify({ regular: "regular value" })
    );
  });

  it("should handle deeply nested objects", () => {
    const obj = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: "deep",
            },
          },
        },
      },
    };
    const proxied = createTemplateVariablesProxy(obj) as {
      level1: {
        level2: {
          level3: {
            level4: { toString(): string; value: string };
          };
        };
      };
    };

    expect(proxied.level1.level2.level3.level4.value).toBe("deep");
    expect(proxied.level1.level2.level3.level4.toString()).toBe(
      JSON.stringify({ value: "deep" })
    );
  });

  it("should handle objects with mixed types", () => {
    const obj = {
      string: "text",
      number: 42,
      boolean: true,
      nullValue: null,
      array: [1, 2, 3],
      object: { nested: "value" },
      nested: {
        mixed: {
          items: ["a", "b"],
          count: 2,
        },
      },
    };
    const proxied = createTemplateVariablesProxy(obj) as {
      string: string;
      number: number;
      boolean: boolean;
      nullValue: null;
      array: number[];
      object: { toString(): string; nested: string };
      nested: {
        mixed: { toString(): string; items: string[]; count: number };
      };
    };

    expect(proxied.string).toBe("text");
    expect(proxied.number).toBe(42);
    expect(proxied.boolean).toBe(true);
    expect(proxied.nullValue).toBe(null);
    expect(Array.isArray(proxied.array)).toBe(true);
    expect(proxied.object.nested).toBe("value");
    expect(proxied.object.toString()).toBe(JSON.stringify({ nested: "value" }));
    expect(proxied.nested.mixed.items).toEqual(["a", "b"]);
    expect(proxied.nested.mixed.count).toBe(2);
    expect(proxied.nested.mixed.toString()).toBe(
      JSON.stringify({ items: ["a", "b"], count: 2 })
    );
  });

  it("should preserve object identity for property access", () => {
    const nested = { value: "test" };
    const obj = { nested };
    const proxied = createTemplateVariablesProxy(obj) as {
      nested: { toString(): string; value: string };
    };

    // The proxied nested object should allow property access
    expect(proxied.nested.value).toBe("test");
    // But when stringified, it should produce JSON
    expect(proxied.nested.toString()).toBe(JSON.stringify({ value: "test" }));
  });

  it("should handle objects with circular references gracefully", () => {
    const obj: Record<string, unknown> = { name: "test" };
    obj.self = obj; // Create circular reference

    // JSON.stringify will throw on circular references, but our proxy should handle it
    const proxied = createTemplateVariablesProxy(obj) as {
      name: string;
      self: unknown;
      toString(): string;
    };

    expect(proxied.name).toBe("test");
    // toString() will throw when JSON.stringify encounters the circular reference
    expect(() => proxied.toString()).toThrow();
  });

  it("should handle objects with Date objects", () => {
    const date = new Date("2023-01-01");
    const obj = { timestamp: date, nested: { date } };
    const proxied = createTemplateVariablesProxy(obj) as {
      timestamp: Date;
      nested: { toString(): string; date: Date };
    };

    // Date objects are proxied, so they won't be the same reference
    // but they should still work as Date objects
    expect(proxied.timestamp instanceof Date).toBe(true);
    expect(proxied.nested.date instanceof Date).toBe(true);
    // Date objects will be stringified as ISO strings by JSON.stringify
    expect(proxied.nested.toString()).toBe(
      JSON.stringify({ date: date.toISOString() })
    );
  });

  it("should handle objects with functions (functions are omitted from JSON)", () => {
    const fn = () => "test";
    const obj = { name: "Alice", method: fn };
    const proxied = createTemplateVariablesProxy(obj) as {
      name: string;
      method: () => string;
      toString(): string;
    };

    expect(proxied.name).toBe("Alice");
    expect(typeof proxied.method).toBe("function");
    // Functions are omitted from JSON.stringify
    expect(proxied.toString()).toBe(JSON.stringify({ name: "Alice" }));
  });
});
