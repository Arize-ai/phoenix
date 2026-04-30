import { describe, expect, it } from "vitest";

import type { BackendInfo, SandboxConfigFormValues } from "../types";
import { formValuesToConfigPatch } from "../utils";

type PartialBackend = Pick<
  BackendInfo,
  "supportsEnvVars" | "internetAccess" | "dependenciesLanguage"
>;

const emptyValues: SandboxConfigFormValues = {
  sandboxProviderId: "",
  name: "",
  description: "",
  timeout: 600,
  envVars: [],
  internetAccessEnabled: false,
  dependenciesText: "",
  dependenciesLockfile: null,
};

const noCapabilityBackend: PartialBackend = {
  supportsEnvVars: false,
  internetAccess: "NONE",
  dependenciesLanguage: null,
};

const fullCapabilityBackend: PartialBackend = {
  supportsEnvVars: true,
  internetAccess: "BOOLEAN",
  dependenciesLanguage: "PYTHON",
};

describe("formValuesToConfigPatch — capability-only output", () => {
  it("(a) no capabilities supported: result is empty", () => {
    const result = formValuesToConfigPatch(
      emptyValues,
      noCapabilityBackend as BackendInfo
    );

    expect(result["env_vars"]).toBeUndefined();
    expect(result["internet_access"]).toBeUndefined();
    expect(result["dependencies"]).toBeUndefined();
  });

  it("(b) backend undefined: result is empty", () => {
    const result = formValuesToConfigPatch(emptyValues, undefined);

    expect(result["env_vars"]).toBeUndefined();
    expect(result["internet_access"]).toBeUndefined();
    expect(result["dependencies"]).toBeUndefined();
  });

  it("(f) capability flag True: form values are authoritative for env_vars", () => {
    const values: SandboxConfigFormValues = {
      ...emptyValues,
      envVars: [{ kind: "literal", name: "NEW", value: "new" }],
    };

    const result = formValuesToConfigPatch(
      values,
      fullCapabilityBackend as BackendInfo
    );

    expect(result["env_vars"]).toEqual([
      { kind: "literal", name: "NEW", value: "new" },
    ]);
  });

  it("(positive) all capabilities set: result contains exactly the three capability keys", () => {
    const values: SandboxConfigFormValues = {
      ...emptyValues,
      envVars: [{ kind: "literal", name: "KEY", value: "val" }],
      internetAccessEnabled: true,
      dependenciesText: "numpy\npandas",
      dependenciesLockfile: "numpy==1.26.0\npandas==2.0.0",
    };

    const result = formValuesToConfigPatch(
      values,
      fullCapabilityBackend as BackendInfo
    );

    expect(result).toEqual({
      env_vars: [{ kind: "literal", name: "KEY", value: "val" }],
      internet_access: { mode: "allow" },
      dependencies: {
        packages: ["numpy", "pandas"],
        lockfile: "numpy==1.26.0\npandas==2.0.0",
      },
    });
  });

  it("(negative) env_vars absent when supportsEnvVars but envVars is empty", () => {
    const result = formValuesToConfigPatch(
      emptyValues,
      fullCapabilityBackend as BackendInfo
    );

    expect(result).not.toHaveProperty("env_vars");
  });

  it("(negative) dependencies absent when dependenciesLanguage set but dependenciesText is empty", () => {
    const result = formValuesToConfigPatch(
      { ...emptyValues, dependenciesText: "" },
      fullCapabilityBackend as BackendInfo
    );

    expect(result).not.toHaveProperty("dependencies");
  });

  it("(negative) internet_access absent when internetAccess is NONE", () => {
    const result = formValuesToConfigPatch(
      { ...emptyValues, internetAccessEnabled: true },
      noCapabilityBackend as BackendInfo
    );

    expect(result).not.toHaveProperty("internet_access");
  });
});
