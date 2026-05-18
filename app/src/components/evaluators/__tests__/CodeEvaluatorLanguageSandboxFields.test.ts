import { describe, expect, it } from "vitest";

import {
  mapSandboxConfigOptions,
  type SandboxConfigOptionConfig,
} from "../CodeEvaluatorLanguageSandboxFields";

const EMPTY_CONFIG: SandboxConfigOptionConfig = {
  envVars: [],
  internetAccess: null,
  dependencies: null,
};

describe("mapSandboxConfigOptions", () => {
  it("sorts available configs by provider label, provider kind, name, then id", () => {
    const options = mapSandboxConfigOptions(
      [
        {
          backendType: "WASM",
          enabled: true,
          configs: [
            {
              id: "wasm-z",
              name: "zeta",
              language: "PYTHON",
              config: EMPTY_CONFIG,
            },
            {
              id: "wasm-a-2",
              name: "alpha",
              language: "PYTHON",
              config: EMPTY_CONFIG,
            },
            {
              id: "wasm-a-1",
              name: "alpha",
              language: "PYTHON",
              config: EMPTY_CONFIG,
            },
          ],
        },
        {
          backendType: "E2B",
          enabled: true,
          configs: [
            {
              id: "e2b-z",
              name: "zeta",
              language: "PYTHON",
              config: EMPTY_CONFIG,
            },
          ],
        },
      ],
      [
        { backendType: "WASM", status: "AVAILABLE" },
        { backendType: "E2B", status: "AVAILABLE" },
      ]
    );

    expect(options.map((option) => option.id)).toEqual([
      "e2b-z",
      "wasm-a-1",
      "wasm-a-2",
      "wasm-z",
    ]);
  });

  it("omits disabled providers and unavailable backends", () => {
    const options = mapSandboxConfigOptions(
      [
        {
          backendType: "E2B",
          enabled: false,
          configs: [
            {
              id: "disabled-provider",
              name: "disabled",
              language: "PYTHON",
              config: EMPTY_CONFIG,
            },
          ],
        },
        {
          backendType: "VERCEL",
          enabled: true,
          configs: [
            {
              id: "unavailable-backend",
              name: "unavailable",
              language: "PYTHON",
              config: EMPTY_CONFIG,
            },
          ],
        },
      ],
      [
        { backendType: "E2B", status: "AVAILABLE" },
        { backendType: "VERCEL", status: "NOT_INSTALLED" },
      ]
    );

    expect(options).toEqual([]);
  });
});
