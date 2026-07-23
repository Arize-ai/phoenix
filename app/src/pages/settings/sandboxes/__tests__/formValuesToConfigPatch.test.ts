import { describe, expect, it } from "vitest";

import type { BackendInfo, SandboxConfigFormValues } from "../types";
import { formValuesToConfigPatch, getDependencyPreview } from "../utils";

const emptyValues: SandboxConfigFormValues = {
  sandboxProviderId: "",
  language: "PYTHON",
  name: "",
  description: "",
  timeout: 600,
  envVars: [],
  internetAccessEnabled: false,
  dependenciesText: "",
};

const wasmNoCapabilityBackend: BackendInfo = {
  backendType: "WASM",
  credentialSpecs: [],
  dependencyHints: [],
  displayName: "WASM",
  hostingType: "LOCAL",
  internetAccess: "NONE",
  status: "AVAILABLE",
  statusDetail: null,
  supportedLanguages: ["PYTHON"],
  supportsDependencies: false,
  supportsEnvVars: false,
};

const e2bFullCapabilityBackend: BackendInfo = {
  backendType: "E2B",
  credentialSpecs: [],
  dependencyHints: [],
  displayName: "E2B",
  hostingType: "HOSTED",
  internetAccess: "BOOLEAN",
  status: "AVAILABLE",
  statusDetail: null,
  supportedLanguages: ["PYTHON"],
  supportsDependencies: true,
  supportsEnvVars: true,
};

describe("formValuesToConfigPatch — variant + capability output", () => {
  it("(a) no capabilities supported: variant carries only language", () => {
    const result = formValuesToConfigPatch(
      emptyValues,
      wasmNoCapabilityBackend
    );

    // WASM variant is the kind-mapped key; inner config carries only
    // ``language`` (required pydantic field on every Config) when no
    // capabilities are configured.
    expect(result).toEqual({ wasm: { language: "PYTHON" } });
  });

  it("(b) backend undefined: result is empty (caller must guard)", () => {
    const result = formValuesToConfigPatch(emptyValues, undefined);
    expect(result).toEqual({});
  });

  it("(f) capability flag True: form values become envVars entries inside the variant", () => {
    const values: SandboxConfigFormValues = {
      ...emptyValues,
      envVars: [{ name: "NEW", secretKey: "new_secret" }],
    };

    const result = formValuesToConfigPatch(values, e2bFullCapabilityBackend);

    expect(result).toEqual({
      e2b: {
        language: "PYTHON",
        envVars: [{ name: "NEW", secretKey: "new_secret" }],
        internetAccess: { mode: "DENY" },
      },
    });
  });

  it("(positive) all capabilities set: variant carries envVars + internetAccess + dependencies", () => {
    const values: SandboxConfigFormValues = {
      ...emptyValues,
      envVars: [{ name: "KEY", secretKey: "key_secret" }],
      internetAccessEnabled: true,
      dependenciesText: "numpy\npandas",
    };

    const result = formValuesToConfigPatch(values, e2bFullCapabilityBackend);

    expect(result).toEqual({
      e2b: {
        language: "PYTHON",
        envVars: [{ name: "KEY", secretKey: "key_secret" }],
        internetAccess: { mode: "ALLOW" },
        dependencies: {
          packages: ["numpy", "pandas"],
        },
      },
    });
  });

  it("(negative) envVars absent when supportsEnvVars but envVars is empty", () => {
    const result = formValuesToConfigPatch(
      emptyValues,
      e2bFullCapabilityBackend
    );

    // internetAccess is always emitted for BOOLEAN backends; envVars is omitted
    // because the list is empty.
    expect(result).toEqual({
      e2b: { language: "PYTHON", internetAccess: { mode: "DENY" } },
    });
  });

  it("(negative) dependencies absent when supportsDependencies is true but dependenciesText is empty", () => {
    const result = formValuesToConfigPatch(
      { ...emptyValues, dependenciesText: "" },
      e2bFullCapabilityBackend
    );

    expect(result["e2b"]).not.toHaveProperty("dependencies");
  });

  it("(negative) internetAccess absent when internetAccess is NONE", () => {
    const result = formValuesToConfigPatch(
      { ...emptyValues, internetAccessEnabled: true },
      wasmNoCapabilityBackend
    );

    expect(result["wasm"]).not.toHaveProperty("internetAccess");
  });

  it("env vars produce flattened secretKey values", () => {
    const values: SandboxConfigFormValues = {
      ...emptyValues,
      envVars: [{ name: "OPENAI_API_KEY", secretKey: "openai_k" }],
    };

    const result = formValuesToConfigPatch(values, e2bFullCapabilityBackend);

    expect(result).toEqual({
      e2b: {
        language: "PYTHON",
        envVars: [{ name: "OPENAI_API_KEY", secretKey: "openai_k" }],
        internetAccess: { mode: "DENY" },
      },
    });
  });
});

describe("getDependencyPreview", () => {
  it("returns null when deps are unsupported", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy",
        supportsDependencies: false,
        language: "PYTHON",
        backendType: "WASM",
      })
    ).toBeNull();
    expect(
      getDependencyPreview({
        packagesText: "numpy",
        supportsDependencies: undefined,
        language: "PYTHON",
        backendType: "E2B",
      })
    ).toBeNull();
  });

  it("returns null when no language is selected", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy",
        supportsDependencies: true,
        language: null,
        backendType: "E2B",
      })
    ).toBeNull();
  });

  it("returns null when packages list is empty", () => {
    expect(
      getDependencyPreview({
        packagesText: "",
        supportsDependencies: true,
        language: "PYTHON",
        backendType: "E2B",
      })
    ).toBeNull();
    expect(
      getDependencyPreview({
        packagesText: "   \n  ",
        supportsDependencies: true,
        language: "PYTHON",
        backendType: "E2B",
      })
    ).toBeNull();
  });

  it("renders pip install for Python on E2B", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy\npandas==2.0",
        supportsDependencies: true,
        language: "PYTHON",
        backendType: "E2B",
      })
    ).toBe("pip install numpy pandas==2.0");
  });

  it("renders pip install for Python on Daytona", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy",
        supportsDependencies: true,
        language: "PYTHON",
        backendType: "DAYTONA",
      })
    ).toBe("pip install numpy");
  });

  it("renders image.pip_install for Python on Modal", () => {
    expect(
      getDependencyPreview({
        packagesText: "numpy\npandas==2.0",
        supportsDependencies: true,
        language: "PYTHON",
        backendType: "MODAL",
      })
    ).toBe('image.pip_install("numpy", "pandas==2.0")');
  });

  it("renders npm install for TypeScript", () => {
    expect(
      getDependencyPreview({
        packagesText: "lodash\n@scope/pkg@1.2.3",
        supportsDependencies: true,
        language: "TYPESCRIPT",
        backendType: "DENO",
      })
    ).toBe("npm install lodash @scope/pkg@1.2.3");
  });
});
