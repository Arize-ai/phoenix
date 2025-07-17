import {
  getErrorMessagesFromRelayMutationError,
  getErrorMessagesFromRelaySubscriptionError,
} from "../errorUtils";

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
