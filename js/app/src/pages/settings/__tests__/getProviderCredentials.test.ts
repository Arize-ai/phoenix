import { describe, expect, it } from "vitest";

import { getProviderCredentials } from "../GenerativeProvidersCard";

type Provider = Parameters<typeof getProviderCredentials>[0];

function provider(
  requirement: { isSetInEnvironment?: boolean; isSetAsSecret?: boolean } = {},
  overrides: Partial<Provider> = {}
): Provider {
  return {
    name: "OpenAI",
    key: "OPENAI",
    dependenciesInstalled: true,
    dependencies: [],
    credentialRequirements: [
      {
        envVarName: "OPENAI_API_KEY",
        isRequired: true,
        isSetInEnvironment: requirement.isSetInEnvironment ?? false,
        isSetAsSecret: requirement.isSetAsSecret ?? false,
      },
    ],
    credentialsSet: false,
    ...overrides,
  } as Provider;
}

describe("getProviderCredentials", () => {
  it("reports a provider without its dependencies as not installed", () => {
    expect(
      getProviderCredentials(
        provider({}, { dependenciesInstalled: false }),
        false
      )
    ).toEqual({
      kind: "status",
      status: { category: "unavailable", label: "Not installed" },
    });
  });

  it("reports a provider that takes no credentials as ready", () => {
    expect(
      getProviderCredentials(
        provider({}, { credentialRequirements: [] }),
        false
      )
    ).toEqual({
      kind: "status",
      status: { category: "succeeded", label: "Ready" },
    });
  });

  it("lists each source in the order Phoenix uses them", () => {
    expect(
      getProviderCredentials(provider({ isSetInEnvironment: true }), true)
    ).toEqual({
      kind: "sources",
      sources: [
        { label: "Browser", isSet: true },
        { label: "Secret", isSet: false },
        { label: "Environment", isSet: true },
      ],
    });
  });
});
