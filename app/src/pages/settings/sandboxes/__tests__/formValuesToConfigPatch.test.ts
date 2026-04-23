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
  configText: "{}",
  envVars: [],
  internetAccessEnabled: false,
  dependenciesText: "",
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

describe("formValuesToConfigPatch — preserve-on-save", () => {
  it("(a) flag flip False→True→False: stored capability-gated key survives a round-trip through unsupported state", () => {
    const storedConfig: Record<string, unknown> = {
      env_vars: [{ kind: "literal", name: "X", value: "1" }],
      some_setting: "abc",
    };

    // Flag flipped to False (supportsEnvVars=false) — env_vars should be preserved from storedConfig
    const result = formValuesToConfigPatch(
      emptyValues,
      noCapabilityBackend as BackendInfo,
      storedConfig
    );

    expect(result["env_vars"]).toEqual(storedConfig["env_vars"]);
    expect(result["some_setting"]).toBe("abc");
  });

  it("(b) activeBackend undefined: capability-gated keys preserved from storedConfig when no backend selected", () => {
    const storedConfig: Record<string, unknown> = {
      env_vars: [{ kind: "literal", name: "KEY", value: "val" }],
      internet_access: { mode: "allow" },
      dependencies: { packages: ["numpy"] },
      extra_key: "preserved",
    };

    const result = formValuesToConfigPatch(
      emptyValues,
      undefined,
      storedConfig
    );

    expect(result["env_vars"]).toEqual(storedConfig["env_vars"]);
    expect(result["internet_access"]).toEqual(storedConfig["internet_access"]);
    expect(result["dependencies"]).toEqual(storedConfig["dependencies"]);
    expect(result["extra_key"]).toBe("preserved");
  });

  it("(c) non-UI-path stored data survives a UI-side save round-trip unchanged", () => {
    // Data written via API (not the UI) — e.g., a lockfile field not exposed in the form
    const storedConfig: Record<string, unknown> = {
      dependencies: { packages: ["pandas"], lockfile: "pandas==2.2.0\n" },
      custom_field: "api-written",
    };

    // Backend does not support dependencies — stored value is preserved verbatim
    const result = formValuesToConfigPatch(
      emptyValues,
      noCapabilityBackend as BackendInfo,
      storedConfig
    );

    expect(result["dependencies"]).toEqual(storedConfig["dependencies"]);
    expect(result["custom_field"]).toBe("api-written");
  });

  it("(d) lockfile preserved when dependenciesLanguage is set and packages edited", () => {
    const storedConfig: Record<string, unknown> = {
      dependencies: { packages: ["old-pkg"], lockfile: "old-pkg==1.0.0\n" },
    };
    const values: SandboxConfigFormValues = {
      ...emptyValues,
      dependenciesText: "new-pkg",
    };

    const result = formValuesToConfigPatch(
      values,
      fullCapabilityBackend as BackendInfo,
      storedConfig
    );

    expect(result["dependencies"]).toEqual({
      packages: ["new-pkg"],
      lockfile: "old-pkg==1.0.0\n",
    });
  });

  it("JSON editor cannot inject env_vars, internet_access, or dependencies via configText", () => {
    const storedConfig: Record<string, unknown> = {};
    const valuesWithInjectedKeys: SandboxConfigFormValues = {
      ...emptyValues,
      configText: JSON.stringify({
        env_vars: [{ kind: "literal", name: "INJECTED", value: "bad" }],
        internet_access: { mode: "allow" },
        dependencies: { packages: ["malicious"] },
        safe_key: "allowed",
      }),
    };

    const result = formValuesToConfigPatch(
      valuesWithInjectedKeys,
      noCapabilityBackend as BackendInfo,
      storedConfig
    );

    expect(result["env_vars"]).toBeUndefined();
    expect(result["internet_access"]).toBeUndefined();
    expect(result["dependencies"]).toBeUndefined();
    expect(result["safe_key"]).toBe("allowed");
  });

  it("capability flag True: form values are authoritative for env_vars", () => {
    const storedConfig: Record<string, unknown> = {
      env_vars: [{ kind: "literal", name: "OLD", value: "old" }],
    };
    const values: SandboxConfigFormValues = {
      ...emptyValues,
      envVars: [{ kind: "literal", name: "NEW", value: "new" }],
    };

    const result = formValuesToConfigPatch(
      values,
      fullCapabilityBackend as BackendInfo,
      storedConfig
    );

    expect(result["env_vars"]).toEqual([
      { kind: "literal", name: "NEW", value: "new" },
    ]);
  });
});
