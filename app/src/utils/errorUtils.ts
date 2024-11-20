/**
 * Regex to match an error message in a Relay mutation error.
 * See example below where "Actual Error Message" is the error message.
 * @example
 * ```
 * "Error fetching GraphQL query 'MutationName' with variables '{'input':{'var1': 'test'}': [{'message':'Actual Error Message','locations':[{'line':4,'column':3}],'path':['responsePath']}]"
 * ```*
 */
const mutationErrorRegex = /"message":"([^"]+)"/g;
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
  error: Error
): string[] | null => {
  const rawErrorMessage = error.message;
  if (typeof rawErrorMessage !== "string") {
    return [];
  }
  const messages = [...rawErrorMessage.matchAll(mutationErrorRegex)].map(
    (match) => match[1]
  );
  return messages;
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
const isErrorWithSource = (error: Error): error is ErrorWithSource => {
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
  error: Error
): string[] | null => {
  if (isErrorWithSource(error)) {
    return error.source.errors.map((error) => error.message);
  }
  return null;
};
