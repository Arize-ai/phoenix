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

describe("phoenix-cli-settings.json", () => {
  it("publishes a JSON-schema artifact with the canonical required fields", () => {
    const parsed = JSON.parse(readFileSync(schemaPath, "utf-8"));
    expect(parsed.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(parsed.required).toContain("activeProfile");
    expect(parsed.required).toContain("profiles");
  });

  it("Zod parser accepts a realistic settings file", () => {
    const result = SettingsFileSchema.safeParse({
      activeProfile: "prod",
      profiles: {
        prod: {
          endpoint: "https://phoenix.example.com",
          project: "main",
          apiKey: "secret",
          headers: { "X-Custom-Header": "value" },
        },
      },
    });
    expect(result.success).toBe(true);
  });
});
