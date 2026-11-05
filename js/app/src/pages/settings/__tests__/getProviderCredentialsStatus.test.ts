import { describe, expect, it } from "vitest";

import { getProviderCredentialsStatus } from "../GenerativeProvidersCard";

type Provider = Parameters<typeof getProviderCredentialsStatus>[0];

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    name: "OpenAI",
    key: "OPENAI",
    dependenciesInstalled: true,
    dependencies: [],
    credentialRequirements: [
      { envVarName: "OPENAI_API_KEY", isRequired: true },
    ],
    credentialsSet: false,
    ...overrides,
  } as Provider;
}

describe("getProviderCredentialsStatus", () => {
  it("reports a provider without its dependencies as not installed", () => {
    expect(
      getProviderCredentialsStatus(
        provider({ dependenciesInstalled: false }),
        false
      )
    ).toEqual({ category: "unavailable", label: "Not installed" });
  });

  it("reports a provider that needs no credentials as ready", () => {
    expect(
      getProviderCredentialsStatus(
        provider({ credentialRequirements: [] }),
        true
      )
    ).toEqual({ category: "succeeded", label: "Ready" });
  });

  it("names where configured credentials are stored, preferring the browser", () => {
    expect(
      getProviderCredentialsStatus(provider({ credentialsSet: true }), true)
    ).toEqual({
      category: "succeeded",
      label: "Configured",
      detail: "In this browser",
    });
    expect(
      getProviderCredentialsStatus(provider({ credentialsSet: true }), false)
    ).toEqual({
      category: "succeeded",
      label: "Configured",
      detail: "On the server",
    });
  });

  it("reports missing credentials as needing them", () => {
    expect(getProviderCredentialsStatus(provider(), false)).toEqual({
      category: "needs-credentials",
      label: "Needs credentials",
    });
  });

  it("names the ambient credential a provider with a default chain can use instead", () => {
    expect(
      getProviderCredentialsStatus(
        provider({
          name: "AWS Bedrock",
          key: "AWS",
          credentialRequirements: [
            { envVarName: "AWS_ACCESS_KEY_ID", isRequired: true },
          ],
        }),
        false
      )
    ).toEqual({
      category: "needs-credentials",
      label: "Needs credentials",
      detail: "Or an IAM role",
    });
  });
});
