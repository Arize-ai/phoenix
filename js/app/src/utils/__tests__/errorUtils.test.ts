import {
  getErrorMessagesFromRelayMutationError,
  getErrorMessagesFromRelaySubscriptionError,
  isAbortError,
} from "../errorUtils";

describe("isAbortError", () => {
  it("should detect the DOMException browsers raise on abort", () => {
    const error = new DOMException("The user aborted a request.", "AbortError");
    expect(isAbortError(error)).toBe(true);
  });

  it("should detect abort errors from non-DOM sources", () => {
    expect(isAbortError({ name: "AbortError" })).toBe(true);
  });

  it("should not treat other errors as aborts", () => {
    expect(isAbortError(new DOMException("No gesture", "SecurityError"))).toBe(
      false
    );
    expect(isAbortError(new Error("AbortError"))).toBe(false);
  });

  it("should tolerate values that are not objects", () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
  });
});

describe("getErrorMessagesFromRelayMutationError", () => {
  it("should extract error messages from a Relay mutation error", () => {
    const error = new Error(
      `Error fetching GraphQL query "MutationName" with variables {"input":{"var1":"test"}: [{"message":"Actual Error Message 'with quotes'","locations":[{"line":4,"column":3}],"path":["responsePath"]}]`
    );
    const result = getErrorMessagesFromRelayMutationError(error);
    expect(result).toEqual(["Actual Error Message 'with quotes'"]);
  });

  it("should return an empty array if no error messages are found", () => {
    const error = new Error("No error messages here");
    const result = getErrorMessagesFromRelayMutationError(error);
    expect(result).toEqual(null);
  });

  it("should return null if the error message is not a string", () => {
    const result = getErrorMessagesFromRelayMutationError({});
    expect(result).toBeNull();
  });
});

describe("getErrorMessagesFromRelaySubscriptionError", () => {
  it("should extract error messages from a Relay subscription error", () => {
    const error = {
      source: {
        errors: [{ message: "Actual Error Message" }],
      },
    };
    const result = getErrorMessagesFromRelaySubscriptionError(error);
    expect(result).toEqual(["Actual Error Message"]);
  });

  it("should return null if the error does not have a source property", () => {
    const error = new Error("No source property here");
    const result = getErrorMessagesFromRelaySubscriptionError(error);
    expect(result).toBeNull();
  });

  it("should return null if the source property does not have an errors array", () => {
    const result = getErrorMessagesFromRelaySubscriptionError({});
    expect(result).toBeNull();
  });
});
