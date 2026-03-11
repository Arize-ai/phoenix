import { describe, expect, it } from "vitest";

import { AuthRequiredError, UserCancelledError, throwIfAuthError } from "../src/errors";
import { EXIT_CODES } from "../src/exitCodes";

describe("EXIT_CODES", () => {
  it("defines success as 0", () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
  });

  it("defines failure as 1", () => {
    expect(EXIT_CODES.FAILURE).toBe(1);
  });

  it("defines cancelled as 2", () => {
    expect(EXIT_CODES.CANCELLED).toBe(2);
  });

  it("defines auth_required as 4", () => {
    expect(EXIT_CODES.AUTH_REQUIRED).toBe(4);
  });

  it("has no duplicate values", () => {
    const values = Object.values(EXIT_CODES);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe("AuthRequiredError", () => {
  it("has name AuthRequiredError", () => {
    const err = new AuthRequiredError();
    expect(err.name).toBe("AuthRequiredError");
  });

  it("is an instance of Error", () => {
    const err = new AuthRequiredError();
    expect(err).toBeInstanceOf(Error);
  });

  it("uses a default message when none provided", () => {
    const err = new AuthRequiredError();
    expect(err.message).toContain("Authentication required");
  });

  it("uses a custom message when provided", () => {
    const err = new AuthRequiredError("Custom auth error");
    expect(err.message).toBe("Custom auth error");
  });
});

describe("UserCancelledError", () => {
  it("has name UserCancelledError", () => {
    const err = new UserCancelledError();
    expect(err.name).toBe("UserCancelledError");
  });

  it("is an instance of Error", () => {
    const err = new UserCancelledError();
    expect(err).toBeInstanceOf(Error);
  });

  it("uses a default message when none provided", () => {
    const err = new UserCancelledError();
    expect(err.message).toContain("cancelled");
  });

  it("uses a custom message when provided", () => {
    const err = new UserCancelledError("Aborted by user");
    expect(err.message).toBe("Aborted by user");
  });
});

describe("throwIfAuthError", () => {
  const makeResponse = (status: number): Response =>
    new Response(null, { status });

  it("throws AuthRequiredError for HTTP 401", () => {
    expect(() => throwIfAuthError(makeResponse(401))).toThrow(AuthRequiredError);
  });

  it("throws AuthRequiredError for HTTP 403", () => {
    expect(() => throwIfAuthError(makeResponse(403))).toThrow(AuthRequiredError);
  });

  it("includes the HTTP status in the error message", () => {
    try {
      throwIfAuthError(makeResponse(401));
    } catch (err) {
      expect((err as Error).message).toContain("401");
    }
  });

  it("does not throw for HTTP 200", () => {
    expect(() => throwIfAuthError(makeResponse(200))).not.toThrow();
  });

  it("does not throw for HTTP 404", () => {
    expect(() => throwIfAuthError(makeResponse(404))).not.toThrow();
  });

  it("does not throw for HTTP 500", () => {
    expect(() => throwIfAuthError(makeResponse(500))).not.toThrow();
  });
});
