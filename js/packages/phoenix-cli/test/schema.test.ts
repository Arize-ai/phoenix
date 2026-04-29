import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import { SettingsFileSchema } from "../src/settings";

const schemaPath = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "schemas",
  "phoenix-cli-settings.json"
);

describe("phoenix-cli-settings.json smoke tests", () => {
  it("schema file exists and is valid JSON", () => {
    const raw = readFileSync(schemaPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(parsed.type).toBe("object");
    expect(parsed.required).toContain("activeProfile");
    expect(parsed.required).toContain("profiles");
    expect(parsed.required).not.toContain("version");
  });

  it("accepts a minimal valid settings file", () => {
    const result = SettingsFileSchema.safeParse({
      activeProfile: null,
      profiles: {},
    });
    expect(result.success).toBe(true);
  });

  it("accepts settings.json with $schema field", () => {
    const result = SettingsFileSchema.safeParse({
      $schema:
        "https://raw.githubusercontent.com/Arize-ai/phoenix/v1.0.0/schemas/phoenix-cli-settings.json",
      activeProfile: "prod",
      profiles: {
        prod: { endpoint: "https://phoenix.example.com", project: "main" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts profile entry with apiKey", () => {
    const result = SettingsFileSchema.safeParse({
      activeProfile: "local",
      profiles: {
        local: {
          endpoint: "http://localhost:6006",
          apiKey: "my-secret-key",
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts profile entry with headers", () => {
    const result = SettingsFileSchema.safeParse({
      activeProfile: "local",
      profiles: {
        local: {
          endpoint: "http://localhost:6006",
          headers: { "X-Custom-Header": "value" },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = SettingsFileSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("strips unknown top-level fields (zod default strip mode)", () => {
    const result = SettingsFileSchema.safeParse({
      activeProfile: null,
      profiles: {},
      unknownField: "oops",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("unknownField");
    }
  });

  it("does not accept version field as required (canonical schema has none)", () => {
    // version is stripped, not required — file with version still parses OK
    const result = SettingsFileSchema.safeParse({
      version: 1,
      activeProfile: null,
      profiles: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("version");
    }
  });

  it("does not accept defaultPermissions (canonical schema has none)", () => {
    // defaultPermissions is stripped as unknown
    const result = SettingsFileSchema.safeParse({
      activeProfile: null,
      defaultPermissions: ["spans.read"],
      profiles: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("defaultPermissions");
    }
  });
});
