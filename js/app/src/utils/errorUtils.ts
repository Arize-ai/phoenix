/**
 * Type-guard for the `AbortError` browsers raise when the user dismisses a
 * picker or an in-flight request is aborted. Structural rather than an
 * `instanceof DOMException` check so it also matches abort errors surfaced by
 * non-DOM sources.
 * @param error - the thrown value to inspect
 * @returns true if the error is named `AbortError`
 */
export const isAbortError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
};

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
  const trailingErrors = parseTrailingGraphQLErrors(rawErrorMessage);
  if (trailingErrors) {
    const messages = trailingErrors.flatMap((entry) =>
      isErrorWithMessage(entry) ? [entry.message] : []
    );
    return messages.length > 0 ? messages : null;
  }
  // The errors array could not be parsed; fall back to scanning the string.
  const messages = [...rawErrorMessage.matchAll(mutationErrorRegex)].map(
    (match) => match[1]
  );
  return messages.length > 0 ? messages : null;
};

/**
 * The GraphQL errors array at the end of a Relay network error message.
 *
 * The network layer formats a failure as
 * `Error fetching GraphQL query 'Name' with variables '{...}': [{...}]`. The
 * variables may carry their own `message` keys (a chat message, a decision
 * state) and even credentials, so the trailing array is located and parsed
 * instead of regexing the whole string.
 */
function parseTrailingGraphQLErrors(rawErrorMessage: string): unknown[] | null {
  let searchFrom = 0;
  for (;;) {
    const arrayStart = rawErrorMessage.indexOf(": [", searchFrom);
    if (arrayStart === -1) return null;
    try {
      const parsed: unknown = JSON.parse(rawErrorMessage.slice(arrayStart + 2));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // A ": [" inside the variables, not the errors array; keep looking.
    }
    searchFrom = arrayStart + 1;
  }
}

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
