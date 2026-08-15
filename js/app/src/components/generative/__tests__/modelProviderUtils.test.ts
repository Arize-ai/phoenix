import { describe, expect, it } from "vitest";

import {
  hasRequiredLocalCredentials,
  isProviderProvisioned,
  isProviderReady,
  providerNeedsCredentials,
  providerRequiresCredentials,
  providerSupportsDefaultCredentialChain,
} from "../modelProviderUtils";

describe("providerNeedsCredentials", () => {
  it("returns true when credentials are required but not set anywhere", () => {
    expect(
      providerNeedsCredentials({
        provider: {
          key: "OPENAI",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        localCredentials: {},
      })
    ).toBe(true);
    // Chain providers still hint — ambient credentials cannot be detected
    expect(
      providerNeedsCredentials({
        provider: {
          key: "AWS",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        localCredentials: {},
      })
    ).toBe(true);
  });

  it("returns false once credentials are set on the server or locally", () => {
    expect(
      providerNeedsCredentials({
        provider: {
          key: "OPENAI",
          dependenciesInstalled: true,
          credentialsSet: true,
        },
        localCredentials: {},
      })
    ).toBe(false);
    expect(
      providerNeedsCredentials({
        provider: {
          key: "ANTHROPIC",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        localCredentials: { ANTHROPIC: { ANTHROPIC_API_KEY: "sk-ant" } },
      })
    ).toBe(false);
  });

  it("returns false for providers that require no credentials", () => {
    expect(
      providerNeedsCredentials({
        provider: {
          key: "OLLAMA",
          dependenciesInstalled: true,
          credentialsSet: true,
        },
        localCredentials: {},
      })
    ).toBe(false);
  });
});

describe("providerSupportsDefaultCredentialChain", () => {
  it("returns true for providers with an ambient credential chain", () => {
    expect(providerSupportsDefaultCredentialChain({ providerKey: "AWS" })).toBe(
      true
    );
    expect(
      providerSupportsDefaultCredentialChain({ providerKey: "AZURE_OPENAI" })
    ).toBe(true);
  });

  it("returns false for other providers", () => {
    expect(
      providerSupportsDefaultCredentialChain({ providerKey: "OPENAI" })
    ).toBe(false);
    expect(
      providerSupportsDefaultCredentialChain({ providerKey: "NOT_A_PROVIDER" })
    ).toBe(false);
  });
});

describe("providerRequiresCredentials", () => {
  it("returns true for providers with credential requirements", () => {
    expect(providerRequiresCredentials({ providerKey: "OPENAI" })).toBe(true);
    expect(providerRequiresCredentials({ providerKey: "AWS" })).toBe(true);
  });

  it("returns false for providers with no credential requirements", () => {
    expect(providerRequiresCredentials({ providerKey: "OLLAMA" })).toBe(false);
  });

  it("assumes unknown providers require credentials", () => {
    expect(providerRequiresCredentials({ providerKey: "NOT_A_PROVIDER" })).toBe(
      true
    );
  });
});

describe("hasRequiredLocalCredentials", () => {
  it("returns true when all required credentials are set", () => {
    expect(
      hasRequiredLocalCredentials({
        providerKey: "OPENAI",
        localCredentials: { OPENAI: { OPENAI_API_KEY: "sk-test" } },
      })
    ).toBe(true);
  });

  it("returns false when a required credential is missing or empty", () => {
    expect(
      hasRequiredLocalCredentials({
        providerKey: "OPENAI",
        localCredentials: {},
      })
    ).toBe(false);
    expect(
      hasRequiredLocalCredentials({
        providerKey: "OPENAI",
        localCredentials: { OPENAI: { OPENAI_API_KEY: "  " } },
      })
    ).toBe(false);
  });

  it("does not require optional credentials", () => {
    expect(
      hasRequiredLocalCredentials({
        providerKey: "AWS",
        localCredentials: {
          AWS: {
            AWS_ACCESS_KEY_ID: "id",
            AWS_SECRET_ACCESS_KEY: "secret",
          },
        },
      })
    ).toBe(true);
  });

  it("returns false when only some required credentials are set", () => {
    expect(
      hasRequiredLocalCredentials({
        providerKey: "AWS",
        localCredentials: { AWS: { AWS_ACCESS_KEY_ID: "id" } },
      })
    ).toBe(false);
  });

  it("returns false for providers with no credential requirements", () => {
    expect(
      hasRequiredLocalCredentials({
        providerKey: "OLLAMA",
        localCredentials: {},
      })
    ).toBe(false);
  });

  it("returns false for unknown providers", () => {
    expect(
      hasRequiredLocalCredentials({
        providerKey: "NOT_A_PROVIDER",
        localCredentials: {},
      })
    ).toBe(false);
  });
});

describe("isProviderReady", () => {
  it("returns false when dependencies are not installed", () => {
    expect(
      isProviderReady({
        provider: {
          key: "OPENAI",
          dependenciesInstalled: false,
          credentialsSet: true,
        },
        localCredentials: {},
      })
    ).toBe(false);
  });

  it("returns true when credentials are set on the server", () => {
    expect(
      isProviderReady({
        provider: {
          key: "OPENAI",
          dependenciesInstalled: true,
          credentialsSet: true,
        },
        localCredentials: {},
      })
    ).toBe(true);
  });

  it("returns true when credentials are set locally in the browser", () => {
    expect(
      isProviderReady({
        provider: {
          key: "ANTHROPIC",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        localCredentials: { ANTHROPIC: { ANTHROPIC_API_KEY: "sk-ant" } },
      })
    ).toBe(true);
  });

  it("returns false when credentials are set neither on the server nor locally", () => {
    expect(
      isProviderReady({
        provider: {
          key: "ANTHROPIC",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        localCredentials: {},
      })
    ).toBe(false);
  });

  it("treats default-credential-chain providers as ready without explicit credentials", () => {
    // e.g. EC2/ECS with an attached IAM role — no AWS_ACCESS_KEY_ID anywhere
    expect(
      isProviderReady({
        provider: {
          key: "AWS",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        localCredentials: {},
      })
    ).toBe(true);
    // e.g. Azure Managed Identity via DefaultAzureCredential — no API key set
    expect(
      isProviderReady({
        provider: {
          key: "AZURE_OPENAI",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        localCredentials: {},
      })
    ).toBe(true);
  });

  it("still requires dependencies for default-credential-chain providers", () => {
    expect(
      isProviderReady({
        provider: {
          key: "AWS",
          dependenciesInstalled: false,
          credentialsSet: false,
        },
        localCredentials: {},
      })
    ).toBe(false);
  });
});

describe("isProviderProvisioned", () => {
  it("never counts zero-credential providers as provisioned", () => {
    // e.g. Ollama reports credentialsSet=true because it has no requirements
    expect(
      isProviderProvisioned({
        provider: {
          key: "OLLAMA",
          dependenciesInstalled: true,
          credentialsSet: true,
        },
        localCredentials: {},
      })
    ).toBe(false);
  });

  it("counts providers whose credentials are satisfied", () => {
    expect(
      isProviderProvisioned({
        provider: {
          key: "OPENAI",
          dependenciesInstalled: true,
          credentialsSet: true,
        },
        localCredentials: {},
      })
    ).toBe(true);
    expect(
      isProviderProvisioned({
        provider: {
          key: "OPENAI",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        localCredentials: { OPENAI: { OPENAI_API_KEY: "sk-test" } },
      })
    ).toBe(true);
  });

  it("does not count providers without satisfied credentials", () => {
    expect(
      isProviderProvisioned({
        provider: {
          key: "OPENAI",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        localCredentials: {},
      })
    ).toBe(false);
  });

  it("does not count default-credential-chain providers without explicit credentials", () => {
    // Ready via the ambient chain, but not explicitly provisioned — the
    // curated "no credentials yet" fallback should still be suppressed only
    // by explicit setup.
    expect(
      isProviderProvisioned({
        provider: {
          key: "AWS",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        localCredentials: {},
      })
    ).toBe(false);
    expect(
      isProviderProvisioned({
        provider: {
          key: "AZURE_OPENAI",
          dependenciesInstalled: true,
          credentialsSet: false,
        },
        localCredentials: {},
      })
    ).toBe(false);
  });

  it("counts explicitly-credentialed providers even when dependencies are missing", () => {
    // Provisioning tracks the user's explicit setup, not server install state
    expect(
      isProviderProvisioned({
        provider: {
          key: "ANTHROPIC",
          dependenciesInstalled: false,
          credentialsSet: false,
        },
        localCredentials: { ANTHROPIC: { ANTHROPIC_API_KEY: "sk-ant" } },
      })
    ).toBe(true);
  });

  it("counts default-credential-chain providers once credentials are explicit", () => {
    expect(
      isProviderProvisioned({
        provider: {
          key: "AWS",
          dependenciesInstalled: true,
          credentialsSet: true,
        },
        localCredentials: {},
      })
    ).toBe(true);
  });
});
