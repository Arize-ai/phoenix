import { describe, expect, it } from "vitest";

import { configToFormValues } from "../SandboxConfigDialog";
import type { SandboxConfig } from "../types";

// `SandboxConfig["config"]` is derived from a Relay generated fragment; the
// tests build minimal-shape fixtures typed against it.
type StoredConfig = SandboxConfig["config"];

const baseStored: StoredConfig = {
  envVars: [],
  internetAccess: null,
  dependencies: null,
};

describe("configToFormValues — stored config → form state", () => {
  it("empty config yields empty form state", () => {
    const result = configToFormValues(baseStored);
    expect(result).toEqual({
      envVars: [],
      internetAccessEnabled: false,
      dependenciesText: "",
    });
  });

  it("env var secret_ref flattens to secretKey", () => {
    const stored: StoredConfig = {
      ...baseStored,
      envVars: [
        {
          name: "OPENAI_API_KEY",
          secretKey: "openai_key",
        },
      ],
    };
    const result = configToFormValues(stored);
    expect(result.envVars).toEqual([
      { name: "OPENAI_API_KEY", secretKey: "openai_key" },
    ]);
  });

  it("internet access ALLOW → enabled true", () => {
    const stored: StoredConfig = {
      ...baseStored,
      internetAccess: { mode: "ALLOW" },
    };
    const result = configToFormValues(stored);
    expect(result.internetAccessEnabled).toBe(true);
  });

  it("internet access DENY → enabled false", () => {
    const stored: StoredConfig = {
      ...baseStored,
      internetAccess: { mode: "DENY" },
    };
    const result = configToFormValues(stored);
    expect(result.internetAccessEnabled).toBe(false);
  });

  it("dependencies → newline-joined packages text", () => {
    const stored: StoredConfig = {
      ...baseStored,
      dependencies: { packages: ["numpy", "pandas==2.0"] },
    };
    const result = configToFormValues(stored);
    expect(result.dependenciesText).toBe("numpy\npandas==2.0");
  });

  it("dependencies null → empty packages text", () => {
    const result = configToFormValues(baseStored);
    expect(result.dependenciesText).toBe("");
  });

  it("multiple env vars preserve order", () => {
    const stored: StoredConfig = {
      ...baseStored,
      envVars: [
        {
          name: "FIRST",
          secretKey: "k1",
        },
        {
          name: "SECOND",
          secretKey: "k2",
        },
        {
          name: "THIRD",
          secretKey: "k3",
        },
      ],
    };
    const result = configToFormValues(stored);
    expect(result.envVars).toEqual([
      { name: "FIRST", secretKey: "k1" },
      { name: "SECOND", secretKey: "k2" },
      { name: "THIRD", secretKey: "k3" },
    ]);
  });
});
