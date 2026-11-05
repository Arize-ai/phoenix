import { describe, expect, it } from "vitest";

import type { CredentialPresence } from "../providerCredentialSources";
import { getCredentialWarnings } from "../providerCredentialSources";

const AWS = [
  { envVarName: "AWS_ACCESS_KEY_ID", isRequired: true },
  { envVarName: "AWS_SECRET_ACCESS_KEY", isRequired: true },
  { envVarName: "AWS_SESSION_TOKEN", isRequired: false },
];

function presence(
  sets: Partial<Record<keyof CredentialPresence, string[]>>
): CredentialPresence {
  return {
    browser: new Set(sets.browser),
    secret: new Set(sets.secret),
    environment: new Set(sets.environment),
  };
}

describe("getCredentialWarnings", () => {
  it("says nothing when nothing is set", () => {
    expect(
      getCredentialWarnings({ requirements: AWS, presence: presence({}) })
    ).toEqual([]);
  });

  it("says nothing when one source sets the whole credential", () => {
    expect(
      getCredentialWarnings({
        requirements: AWS,
        presence: presence({
          secret: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
        }),
      })
    ).toEqual([]);
  });

  it("warns when a required key is set nowhere", () => {
    expect(
      getCredentialWarnings({
        requirements: AWS,
        presence: presence({ browser: ["AWS_ACCESS_KEY_ID"] }),
      })
    ).toEqual([
      "AWS_SECRET_ACCESS_KEY isn't set anywhere. Requests will fail until it is set.",
    ]);
  });

  it("warns when the keys a request would use come from different sources", () => {
    expect(
      getCredentialWarnings({
        requirements: AWS,
        presence: presence({
          browser: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
          environment: ["AWS_SESSION_TOKEN"],
        }),
      })
    ).toEqual([
      "These keys come from different places (This browser, Environment variable). They must belong to the same credential.",
    ]);
  });

  it("ignores a lower source that the keys never reach", () => {
    expect(
      getCredentialWarnings({
        requirements: AWS,
        presence: presence({
          browser: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
          environment: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
        }),
      })
    ).toEqual([]);
  });
});
