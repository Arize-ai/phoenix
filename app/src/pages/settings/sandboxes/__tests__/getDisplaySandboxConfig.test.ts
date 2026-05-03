import { describe, expect, it } from "vitest";

import { getDisplaySandboxConfig } from "../utils";

describe("getDisplaySandboxConfig", () => {
  it("redacts literal env_var values", () => {
    const result = getDisplaySandboxConfig({
      env_vars: [
        { kind: "literal", name: "OPENAI_API_KEY", value: "sk-secret" },
      ],
    });

    expect(result).toEqual({
      env_vars: [
        {
          kind: "literal",
          name: "OPENAI_API_KEY",
          value: "<redacted>",
        },
      ],
    });
  });

  it("preserves secret_ref entries unchanged", () => {
    const config = {
      env_vars: [
        {
          kind: "secret_ref",
          name: "OPENAI_API_KEY",
          secret_key: "openai_key",
        },
      ],
    };

    expect(getDisplaySandboxConfig(config)).toEqual(config);
  });

  it("preserves siblings of env_vars", () => {
    const result = getDisplaySandboxConfig({
      env_vars: [{ kind: "literal", name: "A", value: "1" }],
      internet_access: { mode: "allow" },
      dependencies: { packages: ["numpy"] },
    });

    expect(result).toEqual({
      env_vars: [{ kind: "literal", name: "A", value: "<redacted>" }],
      internet_access: { mode: "allow" },
      dependencies: { packages: ["numpy"] },
    });
  });

  it("does not mutate the input object", () => {
    const original = {
      env_vars: [{ kind: "literal", name: "A", value: "1" }],
    };
    const snapshot = JSON.parse(JSON.stringify(original));

    getDisplaySandboxConfig(original);

    expect(original).toEqual(snapshot);
  });

  it("passes through non-object configs unchanged", () => {
    expect(getDisplaySandboxConfig(null)).toBeNull();
    expect(getDisplaySandboxConfig(undefined)).toBeUndefined();
    expect(getDisplaySandboxConfig("string")).toBe("string");
    expect(getDisplaySandboxConfig(42)).toBe(42);
  });

  it("passes through malformed env_vars (non-array) unchanged", () => {
    const result = getDisplaySandboxConfig({
      env_vars: "not-an-array",
    });
    expect(result).toEqual({ env_vars: "not-an-array" });
  });

  it("passes through malformed env_var entries (non-object) unchanged", () => {
    const result = getDisplaySandboxConfig({
      env_vars: ["string-entry", null, 42],
    });
    expect(result).toEqual({
      env_vars: ["string-entry", null, 42],
    });
  });

  it("does not throw on literal entry missing value field", () => {
    const result = getDisplaySandboxConfig({
      env_vars: [{ kind: "literal", name: "A" }],
    });
    expect(result).toEqual({
      env_vars: [{ kind: "literal", name: "A" }],
    });
  });
});
