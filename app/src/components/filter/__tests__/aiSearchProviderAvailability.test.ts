import { describe, expect, it } from "vitest";

import type { LocalProviderCredentials } from "@phoenix/components/generative/modelProviderUtils";

import { isAISearchProviderAvailable } from "../ai/providerModels";

const noCredentials: LocalProviderCredentials = {};

describe("isAISearchProviderAvailable", () => {
  it("accepts a browser-callable provider whose key is in the browser store", () => {
    expect(
      isAISearchProviderAvailable({
        providerKey: "OPENAI",
        credentials: { OPENAI: { OPENAI_API_KEY: "sk-test" } },
      })
    ).toBe(true);
  });

  it("rejects a browser-callable provider with no key in the browser store", () => {
    expect(
      isAISearchProviderAvailable({
        providerKey: "OPENAI",
        credentials: noCredentials,
      })
    ).toBe(false);
  });

  it("rejects a key that is only whitespace", () => {
    expect(
      isAISearchProviderAvailable({
        providerKey: "ANTHROPIC",
        credentials: { ANTHROPIC: { ANTHROPIC_API_KEY: "   " } },
      })
    ).toBe(false);
  });

  it.each(["AWS", "AZURE_OPENAI"])(
    "rejects %s even when its credentials are present, since AI search cannot call it from the browser",
    (providerKey) => {
      expect(
        isAISearchProviderAvailable({
          providerKey,
          credentials: {
            AWS: {
              AWS_ACCESS_KEY_ID: "key",
              AWS_SECRET_ACCESS_KEY: "secret",
            },
            AZURE_OPENAI: { AZURE_OPENAI_API_KEY: "key" },
          },
        })
      ).toBe(false);
    }
  );

  it("accepts a provider that requires no credentials", () => {
    expect(
      isAISearchProviderAvailable({
        providerKey: "OLLAMA",
        credentials: noCredentials,
      })
    ).toBe(true);
  });

  it("rejects an unknown provider key", () => {
    expect(
      isAISearchProviderAvailable({
        providerKey: "NOT_A_PROVIDER",
        credentials: noCredentials,
      })
    ).toBe(false);
  });
});
