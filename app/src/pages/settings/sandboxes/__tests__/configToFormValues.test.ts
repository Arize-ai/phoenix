import { describe, expect, it } from "vitest";

import { configToFormValues } from "../SandboxConfigDialog";
import type { SandboxConfig } from "../types";

// `SandboxConfig["config"]` is derived from a Relay generated fragment; the
// tests build minimal-shape fixtures and cast — same pattern as
// formValuesToConfigPatch.test.ts.
type StoredConfig = SandboxConfig["config"];

const baseStored = {
  envVars: [],
  internetAccess: null,
  dependencies: null,
};

describe("configToFormValues — stored config → form state", () => {
  it("empty config yields empty form state", () => {
    const result = configToFormValues(baseStored as StoredConfig);
    expect(result).toEqual({
      envVars: [],
      internetAccessEnabled: false,
      dependenciesText: "",
    });
  });

  it("env var literal preserves typename → kind='literal' + value", () => {
    const stored = {
      ...baseStored,
      envVars: [
        {
          name: "API_KEY",
          value: {
            __typename: "SandboxConfigEnvVarLiteral",
            literal: "hello-world",
          },
        },
      ],
    };
    const result = configToFormValues(stored as unknown as StoredConfig);
    expect(result.envVars).toEqual([
      { kind: "literal", name: "API_KEY", value: "hello-world" },
    ]);
  });

  it("env var secret_ref preserves typename → kind='secret_ref' + secret_key", () => {
    const stored = {
      ...baseStored,
      envVars: [
        {
          name: "OPENAI_API_KEY",
          value: {
            __typename: "SandboxConfigEnvVarSecretRef",
            secretKey: "openai_key",
          },
        },
      ],
    };
    const result = configToFormValues(stored as unknown as StoredConfig);
    expect(result.envVars).toEqual([
      { kind: "secret_ref", name: "OPENAI_API_KEY", secret_key: "openai_key" },
    ]);
  });

  it("unknown union member falls back to empty literal (schema-drift guard)", () => {
    // Future schema additions to SandboxConfigEnvVarValue should not break the
    // edit dialog — the fallback at SandboxConfigDialog.tsx:200-201 returns an
    // empty literal so the row is still editable.
    const stored = {
      ...baseStored,
      envVars: [
        {
          name: "FUTURE_KIND",
          value: { __typename: "%other" },
        },
      ],
    };
    const result = configToFormValues(stored as unknown as StoredConfig);
    expect(result.envVars).toEqual([
      { kind: "literal", name: "FUTURE_KIND", value: "" },
    ]);
  });

  it("internet access ALLOW → enabled true", () => {
    const stored = { ...baseStored, internetAccess: { mode: "ALLOW" } };
    const result = configToFormValues(stored as unknown as StoredConfig);
    expect(result.internetAccessEnabled).toBe(true);
  });

  it("internet access DENY → enabled false", () => {
    const stored = { ...baseStored, internetAccess: { mode: "DENY" } };
    const result = configToFormValues(stored as unknown as StoredConfig);
    expect(result.internetAccessEnabled).toBe(false);
  });

  it("dependencies → newline-joined packages text", () => {
    const stored = {
      ...baseStored,
      dependencies: { packages: ["numpy", "pandas==2.0"] },
    };
    const result = configToFormValues(stored as unknown as StoredConfig);
    expect(result.dependenciesText).toBe("numpy\npandas==2.0");
  });

  it("dependencies null → empty packages text", () => {
    const result = configToFormValues(baseStored as StoredConfig);
    expect(result.dependenciesText).toBe("");
  });

  it("mixed env vars preserve order and discrimination", () => {
    const stored = {
      ...baseStored,
      envVars: [
        {
          name: "FIRST",
          value: {
            __typename: "SandboxConfigEnvVarLiteral",
            literal: "v1",
          },
        },
        {
          name: "SECOND",
          value: {
            __typename: "SandboxConfigEnvVarSecretRef",
            secretKey: "k2",
          },
        },
        {
          name: "THIRD",
          value: {
            __typename: "SandboxConfigEnvVarLiteral",
            literal: "v3",
          },
        },
      ],
    };
    const result = configToFormValues(stored as unknown as StoredConfig);
    expect(result.envVars).toEqual([
      { kind: "literal", name: "FIRST", value: "v1" },
      { kind: "secret_ref", name: "SECOND", secret_key: "k2" },
      { kind: "literal", name: "THIRD", value: "v3" },
    ]);
  });
});
