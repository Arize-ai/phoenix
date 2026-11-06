import { describe, expect, it } from "vitest";

import { redact, redactForDisplay } from "../../src/setup/util/redact";

describe("redact", () => {
  it("scrubs bearer tokens", () => {
    expect(redact("Authorization: Bearer abc123def456")).toBe(
      "Authorization: Bearer [REDACTED]"
    );
  });

  it("scrubs PHOENIX_API_KEY assignments", () => {
    expect(redact("PHOENIX_API_KEY=sk-something-secret")).toBe(
      "PHOENIX_API_KEY=[REDACTED]"
    );
  });

  it("scrubs JWT-shaped tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.SflKxwRJSMeKKF2QT";
    expect(redact(`token ${jwt} rejected`)).toBe("token [REDACTED] rejected");
  });

  it("scrubs long base64url runs", () => {
    const token = "a".repeat(40);
    expect(redact(`got ${token}`)).toBe("got [REDACTED]");
  });

  it("leaves ordinary error text alone", () => {
    const text = "connect ECONNREFUSED 127.0.0.1:6006";
    expect(redact(text)).toBe(text);
  });
});

describe("redactForDisplay", () => {
  it("truncates to 500 chars after scrubbing", () => {
    const long = "x ".repeat(600);
    const result = redactForDisplay(long);
    expect(result.length).toBeLessThanOrEqual(501);
    expect(result.endsWith("…")).toBe(true);
  });
});
