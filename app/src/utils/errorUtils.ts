const isErrorWithMessage = (error: unknown): error is { message: string } => {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { message: unknown }).message === "string"
  );
};

/**
 * Regex to match an error message in a Relay mutation error.
 * See example below where "Actual Error Message" is the error message.
 * Matches the string after the first occurrence of "message": " and before the next occurrence of " with double quotes.
 * @example
 * ```
 * "Error fetching GraphQL query 'MutationName' with variables '{'input':{'var1': 'test'}': [{'message':'Actual Error Message','locations':[{'line':4,'column':3}],'path':['responsePath']}]"
 * ```*
 */
const mutationErrorRegex = /["]message["]:\s*["]([^""]+)["]/g;
/**
 * Extracts the error messages from a Relay mutation error.
 * A relay mutation error contains a message property which is a large string with various information.
 * @example
 * ```
 * "Error fetching GraphQL query 'MutationName' with variables '{'input':{'var1': 'test'}': [{'message':'Actual Error Message','locations':[{'line':4,'column':3}],'path':['responsePath']}]"
 * ```
 * This function extracts the actual error messages from the message block.
 * @param error
 * @returns a list of string error messages or null if no error messages are found
 */
export const getErrorMessagesFromRelayMutationError = (
  error: unknown
): string[] | null => {
  if (!isErrorWithMessage(error)) {
    return null;
  }
  const rawErrorMessage = error.message;
  if (typeof rawErrorMessage !== "string") {
    return null;
  }
  const messages = [...rawErrorMessage.matchAll(mutationErrorRegex)].map(
    (match) => match[1]
  );
  return messages.length > 0 ? messages : null;
};

interface ErrorWithSource extends Error {
  source: {
    errors: { message: string }[];
  };
}

/**
 * Type-guard for determining if an error has a source corresponding to a Relay subscription error.
 * @see https://github.com/facebook/relay/blob/30af0031e0505311de5b1f597bbebef912ba0817/packages/relay-runtime/store/OperationExecutor.js#L412-L435
 * @param error
 * @returns true if the error has a source property with an errors array, false otherwise
 */
const isErrorWithSource = (error: unknown): error is ErrorWithSource => {
  const errorWithSource = error as ErrorWithSource;
  return (
    typeof errorWithSource === "object" &&
    errorWithSource !== null &&
    typeof errorWithSource.source === "object" &&
    errorWithSource.source !== null &&
    Array.isArray(errorWithSource.source.errors) &&
    errorWithSource.source.errors.every(
      (error) =>
        typeof error === "object" &&
        error !== null &&
        typeof error.message === "string"
    )
  );
};

const isErrorsArray = (errors: unknown): errors is { message: string }[] => {
  return (
    Array.isArray(errors) &&
    errors.every(
      (error) =>
        typeof error === "object" &&
        error !== null &&
        typeof error.message === "string"
    )
  );
};

/**
 * Extracts the error messages from a Relay subscription error.
 * A relay subscription error contains a source property with an errors array.
 * This error array contains the actual error messages.
 * @example
 * ```typescript
 * {
 *  // Other error properties
 *  source: {
 *      errors: [{ message: "Actual Error Message" }]
 *  }
 * }
 * ```
 * Relay actually recommends looking here for more info even though there errors are not typed as such
 * @see https://github.com/facebook/relay/blob/30af0031e0505311de5b1f597bbebef912ba0817/packages/relay-runtime/store/OperationExecutor.js#L412-L435
 * @param error
 * @returns a list of string error messages or null if no error messages are found
 */
export const getErrorMessagesFromRelaySubscriptionError = (
  error: unknown
): string[] | null => {
  if (isErrorWithSource(error)) {
    return error.source.errors.map((error) => error.message);
  }
  if (isErrorsArray(error)) {
    return error.map((error) => error.message);
  }
  return null;
};
