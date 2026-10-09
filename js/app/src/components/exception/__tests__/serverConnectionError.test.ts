import { describe, expect, it } from "vitest";

import {
  classifyServerConnectionError,
  isServerConnectionError,
  ServerResponseError,
} from "../serverConnectionError";

describe("classifyServerConnectionError", () => {
  it.each([502, 503])("classifies a %s response as unavailable", (status) => {
    expect(
      classifyServerConnectionError(
        new ServerResponseError("Gateway response", status)
      )
    ).toBe("unavailable");
  });

  it("classifies a 504 response as a timeout", () => {
    expect(
      classifyServerConnectionError(
        new ServerResponseError("Gateway response", 504)
      )
    ).toBe("timeout");
  });

  it("uses the response status rather than inferring from the body", () => {
    expect(
      classifyServerConnectionError(
        new ServerResponseError("upstream request timed out", 503)
      )
    ).toBe("unavailable");
    expect(
      classifyServerConnectionError(
        new ServerResponseError("upstream connect error", 504)
      )
    ).toBe("timeout");
  });

  it("does not classify other response statuses", () => {
    expect(
      classifyServerConnectionError(
        new ServerResponseError("<!DOCTYPE html>", 403)
      )
    ).toBeNull();
    expect(
      classifyServerConnectionError(
        new ServerResponseError("connect ECONNREFUSED", 500)
      )
    ).toBeNull();
  });

  it("does not classify GraphQL or application errors", () => {
    expect(
      classifyServerConnectionError(
        new Error("connect ECONNREFUSED 127.0.0.1:11434")
      )
    ).toBeNull();
    expect(classifyServerConnectionError(null)).toBeNull();
  });
});

describe("isServerConnectionError", () => {
  it("detects classified server responses", () => {
    expect(
      isServerConnectionError(new ServerResponseError("Gateway response", 503))
    ).toBe(true);
  });

  it("rejects ordinary errors", () => {
    expect(isServerConnectionError(new Error("connect ECONNREFUSED"))).toBe(
      false
    );
  });
});
