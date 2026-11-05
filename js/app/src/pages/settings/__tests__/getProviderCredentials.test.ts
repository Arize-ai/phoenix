import { describe, expect, it } from "vitest";

import { getProviderCredentials } from "../GenerativeProvidersCard";

type Provider = Parameters<typeof getProviderCredentials>[0];
type Requirement = Provider["credentialRequirements"][number];

function requirement(
  envVarName: string,
  overrides: Partial<Requirement> = {}
): Requirement {
  return {
    envVarName,
    isRequired: true,
    isSetInEnvironment: false,
    isSetAsSecret: false,
    ...overrides,
  };
}

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    name: "OpenAI",
    key: "OPENAI",
    dependenciesInstalled: true,
    dependencies: [],
    credentialRequirements: [requirement("OPENAI_API_KEY")],
    credentialsSet: false,
    ...overrides,
  } as Provider;
}

const AWS_REQUIREMENTS = (overrides: {
  secretInEnvironment?: boolean;
}): Requirement[] => [
  requirement("AWS_ACCESS_KEY_ID"),
  requirement("AWS_SECRET_ACCESS_KEY", {
    isSetInEnvironment: overrides.secretInEnvironment ?? false,
  }),
  requirement("AWS_SESSION_TOKEN", { isRequired: false }),
];

describe("getProviderCredentials", () => {
  it("reports a provider without its dependencies as not installed", () => {
    expect(
      getProviderCredentials(
        provider({ dependenciesInstalled: false }),
        new Set()
      )
    ).toEqual({
      kind: "status",
      status: { category: "unavailable", label: "Not installed" },
    });
  });

  it("reports a provider that takes no credentials as ready", () => {
    expect(
      getProviderCredentials(
        provider({ credentialRequirements: [] }),
        new Set()
      )
    ).toEqual({
      kind: "status",
      status: { category: "succeeded", label: "Ready" },
    });
  });

  it("lists each source in the order Phoenix uses them", () => {
    expect(
      getProviderCredentials(
        provider({
          credentialRequirements: [
            requirement("OPENAI_API_KEY", { isSetInEnvironment: true }),
          ],
        }),
        new Set(["OPENAI_API_KEY"])
      )
    ).toEqual({
      kind: "sources",
      sources: [
        { category: "succeeded", label: "Browser" },
        { category: "unset", label: "Secret" },
        { category: "succeeded", label: "Environment" },
      ],
    });
  });

  it("marks a source that sets only some required keys as partial", () => {
    expect(
      getProviderCredentials(
        provider({
          key: "AWS",
          credentialRequirements: AWS_REQUIREMENTS({
            secretInEnvironment: true,
          }),
        }),
        new Set(["AWS_ACCESS_KEY_ID", "AWS_SESSION_TOKEN"])
      )
    ).toEqual({
      kind: "sources",
      sources: [
        { category: "needs-credentials", label: "Browser", detail: "1 of 2" },
        { category: "unset", label: "Secret" },
        {
          category: "needs-credentials",
          label: "Environment",
          detail: "1 of 2",
        },
      ],
    });
  });

  it("says a provider with nothing set uses its default credentials", () => {
    expect(
      getProviderCredentials(
        provider({ key: "AWS", credentialRequirements: AWS_REQUIREMENTS({}) }),
        new Set()
      )
    ).toEqual({ kind: "default-chain" });
  });
});
