import { describe, expect, it } from "vitest";

import type { BackendInfo, SandboxConfigFormValues } from "../types";
import {
  formValuesToConfigPatch,
  getDependencyPackages,
  getDependencyPreview,
  getDisplaySandboxConfig,
} from "../utils";

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

describe("getDependencyPackages", () => {
  it("trims whitespace and drops empty lines", () => {
    expect(getDependencyPackages("  numpy  \n\n pandas\n")).toEqual([
      "numpy",
      "pandas",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(getDependencyPackages("")).toEqual([]);
    expect(getDependencyPackages("   \n  ")).toEqual([]);
  });
});

describe("getDependencyPreview", () => {
  it("returns null when no language is advertised", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy",
        dependenciesLanguage: null,
        backendType: "E2B",
      })
    ).toBeNull();
    expect(
      getDependencyPreview({
        packagesText: "numpy",
        dependenciesLanguage: undefined,
        backendType: "E2B",
      })
    ).toBeNull();
  });

  it("returns null when packages list is empty", () => {
    expect(
      getDependencyPreview({
        packagesText: "",
        dependenciesLanguage: "PYTHON",
        backendType: "E2B",
      })
    ).toBeNull();
    expect(
      getDependencyPreview({
        packagesText: "   \n  ",
        dependenciesLanguage: "PYTHON",
        backendType: "E2B",
      })
    ).toBeNull();
  });

  it("renders pip install for Python on E2B", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy\npandas==2.0",
        dependenciesLanguage: "PYTHON",
        backendType: "E2B",
      })
    ).toBe("pip install numpy pandas==2.0");
  });

  it("renders pip install for Python on Daytona", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy",
        dependenciesLanguage: "PYTHON",
        backendType: "DAYTONA_PYTHON",
      })
    ).toBe("pip install numpy");
  });

  it("renders image.pip_install for Python on Modal", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy\npandas==2.0",
        dependenciesLanguage: "PYTHON",
        backendType: "MODAL",
      })
    ).toBe('image.pip_install("numpy", "pandas==2.0")');
  });

  it("renders unavailable for TypeScript", () => {
    expect(
      getDependencyPreview({
        packagesText: "lodash",
        dependenciesLanguage: "TYPESCRIPT",
        backendType: "DENO",
      })
    ).toBe("preview unavailable for typescript");
  });
});

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
