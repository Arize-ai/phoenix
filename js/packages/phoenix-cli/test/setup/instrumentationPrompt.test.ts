/**
 * Instrumentation prompt tests. The prompt is the only instruction a launched
 * agent gets, so the rules it carries are asserted here rather than only
 * through the lanes that hand it over.
 */

import { describe, expect, it } from "vitest";

import {
  buildInstrumentationPrompt,
  type InstrumentationPromptArgs,
} from "../../src/setup/prompts/instrumentationPrompt";

const ARGS: InstrumentationPromptArgs = {
  projectName: "my-app",
  endpoint: "http://localhost:6006",
  isDefaultEndpoint: true,
  docs: {
    quickstartPython: "https://arize.com/docs/phoenix/quickstart",
    quickstartTypeScript: "https://arize.com/docs/phoenix/quickstart-ts",
    phoenixOtelSetup: "https://arize.com/docs/phoenix/otel",
    integrationsIndex: "https://arize.com/docs/phoenix/integrations",
  },
  tracesUrl: "http://localhost:6006/redirects/projects/my-app",
  authEnabled: false,
};

describe("buildInstrumentationPrompt", () => {
  it("spells out the OTLP traces URL for exporters taking a full URL", () => {
    const prompt = buildInstrumentationPrompt(ARGS);
    expect(prompt).toContain("http://localhost:6006/v1/traces");
  });

  it("derives the OTLP traces URL from a remote endpoint", () => {
    const prompt = buildInstrumentationPrompt({
      ...ARGS,
      endpoint: "https://phoenix.example.com/s/my-space",
      isDefaultEndpoint: false,
    });
    expect(prompt).toContain(
      "https://phoenix.example.com/s/my-space/v1/traces"
    );
  });

  it("tells full-URL exporters to build the OTLP URL in code, not the variable", () => {
    // Exporters that POST to exactly the URL they are given need the path in
    // code; the variables stay base URLs.
    const prompt = buildInstrumentationPrompt(ARGS);
    expect(prompt).toContain("build the full");
    expect(prompt).toContain(
      "do not rewrite them to carry the /v1/traces path"
    );
  });

  it("explains which endpoint variable serves traces and which serves the API", () => {
    const prompt = buildInstrumentationPrompt(ARGS);
    expect(prompt).toContain(
      "PHOENIX_COLLECTOR_ENDPOINT is where traces are exported"
    );
    expect(prompt).toContain("PHOENIX_ENDPOINT serves everything");
  });

  it("names the project and, off the default endpoint, the endpoint too", () => {
    expect(buildInstrumentationPrompt(ARGS)).toContain('project name "my-app"');
    expect(
      buildInstrumentationPrompt({
        ...ARGS,
        endpoint: "https://phoenix.example.com",
        isDefaultEndpoint: false,
      })
    ).toContain("it is https://phoenix.example.com.");
  });
});
