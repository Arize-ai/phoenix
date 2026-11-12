import { createFetchMultipartSubscription } from "@apollo/client/utilities/subscriptions/relay";
import type {
  FetchFunction,
  GraphQLResponse,
  GraphQLSingularResponse,
} from "relay-runtime";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import invariant from "tiny-invariant";

import { authFetch } from "@phoenix/authFetch";
import { ServerResponseError } from "@phoenix/components/exception/serverConnectionError";
import { BASE_URL } from "@phoenix/config";

import {
  instrumentRelayEnvironment,
  isRelayDebugEnabled,
} from "./relayDebugInstrumentation";
import {
  INCREMENTAL_ACCEPT_HEADER,
  isMultipartMixedResponse,
  readMultipartMixed,
  usesIncrementalDelivery,
} from "./relayIncrementalDelivery";
import { createIncrementalDeliveryConverter } from "./relayIncrementalDeliveryConverter";
import { isObject, isStringKeyedObject } from "./typeUtils";

const graphQLPath = BASE_URL + "/graphql";

const isAuthenticationEnabled = window.Config.authenticationEnabled;
const graphQLFetch = isAuthenticationEnabled ? authFetch : fetch;

// The maximum number of characters of a failed response body to include in an
// error message. Large enough to clear the boilerplate <head> of a CSS-heavy
// gateway error page and reach the actual error, small enough to stay readable.
const ERROR_BODY_SNIPPET_LENGTH = 1000;

/**
 * Reads a single JSON GraphQL response body, failing with a descriptive
 * {@link ServerResponseError} when the body is empty, not JSON, or a non-OK
 * status without a GraphQL error envelope.
 */
async function readJsonResponse(response: Response): Promise<unknown> {
  invariant(response instanceof Response, "response must be a Response");
  // Clone the response so the raw body is still readable as text if
  // response.json() fails — an empty or non-JSON response (for example a
  // gateway timeout or an upstream 5xx returning an HTML error page)
  // should surface a descriptive error instead of the opaque
  // "Unexpected end of JSON input" thrown by response.json().
  const responseClone = response.clone();
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    const text = (await responseClone.text()).trim();
    if (text === "") {
      throw new ServerResponseError(
        `GraphQL request failed: the server returned an empty response (status ${response.status} ${response.statusText}).`,
        response.status
      );
    }
    // The body is likely an HTML error page from a gateway or proxy.
    // Include a snippet to make the failure easier to diagnose.
    const snippet = text.slice(0, ERROR_BODY_SNIPPET_LENGTH);
    throw new ServerResponseError(
      `GraphQL request failed: the server returned a non-JSON response (status ${response.status} ${response.statusText}): ${snippet}`,
      response.status
    );
  }
  // A non-OK status with a parseable body still indicates a failure.
  // Defer to the GraphQL "errors" handling below when the body carries
  // them (so the precise GraphQL error is surfaced); otherwise fail
  // loudly with the HTTP status rather than treating the body as data.
  if (!response.ok && !(isObject(data) && "errors" in data)) {
    // The body parsed as JSON but is not a GraphQL error envelope (for
    // example a load balancer or auth layer error). Include a snippet so
    // the failure is diagnosable rather than reported as a bare status.
    const snippet = JSON.stringify(data).slice(0, ERROR_BODY_SNIPPET_LENGTH);
    throw new ServerResponseError(
      `GraphQL request failed with status ${response.status} ${response.statusText}: ${snippet}`,
      response.status
    );
  }
  return data;
}

function isResponseList(
  payload: GraphQLResponse
): payload is ReadonlyArray<GraphQLSingularResponse> {
  return Array.isArray(payload);
}

function isGraphQLSingularResponse(
  value: unknown
): value is GraphQLSingularResponse {
  return (
    isStringKeyedObject(value) &&
    !Array.isArray(value) &&
    ("data" in value || "errors" in value)
  );
}

/**
 * Create an observable that fetches a GraphQL response from the given input
 * and returns an error if any payload has errors.
 *
 * A JSON response emits once. A `multipart/mixed` response (an operation with
 * `@defer`) emits once per part, as the payloads Relay reads, so the initial
 * data renders while deferred fragments are still on their way.
 *
 * The observable aborts in-flight network requests when the unsubscribe function is
 * called. A request that has already finished is not aborted.
 *
 * @param input - The input to fetch from.
 * @param init - The request init options.
 * @param hasErrors - A function that returns an error if a payload has errors.
 * @returns An observable that emits the payloads or an error.
 */
function fetchGraphQLObservable(
  input: RequestInfo | URL,
  init: RequestInit,
  hasErrors: (data: unknown) => Error | undefined
): Observable<GraphQLResponse> {
  return Observable.create((sink) => {
    const controller = new AbortController();
    let isFinished = false;

    const emit = (payload: GraphQLResponse) => {
      const payloads = isResponseList(payload) ? payload : [payload];
      for (const response of payloads) {
        const error = hasErrors(response);
        if (error) {
          throw error;
        }
      }
      sink.next(payload);
    };

    graphQLFetch(input, { ...init, signal: controller.signal })
      .then(async (response) => {
        invariant(response instanceof Response, "response must be a Response");
        if (!isMultipartMixedResponse(response)) {
          const data = await readJsonResponse(response);
          if (!isGraphQLSingularResponse(data)) {
            throw new ServerResponseError(
              `GraphQL request failed: the response has neither data nor errors (status ${response.status} ${response.statusText}).`,
              response.status
            );
          }
          emit(data);
          return;
        }
        if (!response.ok) {
          throw new ServerResponseError(
            `GraphQL request failed with status ${response.status} ${response.statusText}`,
            response.status
          );
        }
        // One converter per request: it keeps the data the request has sent,
        // to send each deferred fragment whole when it completes.
        // TODO: pass parts to Relay unconverted once relay-runtime ships its
        // own converter (facebook/relay@c270fbf).
        const converter = createIncrementalDeliveryConverter();
        for await (const part of readMultipartMixed(response)) {
          const payloads = converter.convert(part);
          if (payloads.length > 0) {
            emit(payloads);
          }
        }
      })
      .then(() => {
        isFinished = true;
        sink.complete();
      })
      .catch((error) => {
        isFinished = true;
        if (error.name === "AbortError") {
          // this is triggered when the controller is aborted
          sink.complete();
        } else {
          // this is triggered when graphQLFetch throws an error or the response
          // data has errors
          sink.error(error);
        }
      });

    return () => {
      // Abort the fetch request when the observable is unsubscribed while it
      // is still in flight. Relay also runs this cleanup right after
      // sink.complete(), and aborting a finished request would reject any
      // promise still tied to the signal with an AbortError that nothing
      // handles.
      if (!isFinished) {
        controller.abort();
      }
    };
  });
}

/**
 * Relay requires developers to configure a "fetch" function that tells Relay how to load
 * the results of GraphQL queries from your server (or other data source). See more at
 * https://relay.dev/docs/en/quick-start-guide#relay-environment.
 */
export const fetchRelay: FetchFunction = (params, variables, _cacheConfig) =>
  fetchGraphQLObservable(
    graphQLPath,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Only operations with @defer ask for a streamed response, so every
        // other operation keeps its single JSON body.
        ...(usesIncrementalDelivery(params.text)
          ? { Accept: INCREMENTAL_ACCEPT_HEADER }
          : {}),
      },
      body: JSON.stringify({
        query: params.text,
        variables,
      }),
    },
    // GraphQL returns exceptions (for example, a missing required variable) in the "errors"
    // property of the response. If any exceptions occurred when processing the request,
    // throw an error to indicate to the developer what went wrong.
    (data) => {
      if (!isObject(data) || !("errors" in data)) {
        return undefined;
      }
      if (Array.isArray(data.errors)) {
        // The variables stay out of the message: it is reported to the server
        // log, and they carry whatever the user typed.
        return new Error(
          `Error fetching GraphQL query '${params.name}': ${JSON.stringify(data.errors)}`
        );
      }
      return undefined;
    }
  );

const subscribe = createFetchMultipartSubscription(graphQLPath, {
  fetch: graphQLFetch,
});

const relayStore = new Store(new RecordSource(), {
  // This property tells Relay to not immediately clear its cache when the user
  // navigates around the app. Relay will hold onto the specified number of
  // query results, allowing the user to return to recently visited pages
  // and reusing cached data if its available/fresh.
  gcReleaseBufferSize: 20,
});

const relayEnvironment = new Environment({
  network: Network.create(fetchRelay, subscribe),
  store: relayStore,
});

if (isRelayDebugEnabled()) {
  instrumentRelayEnvironment({
    environment: relayEnvironment,
    store: relayStore,
  });
}

// Export a singleton instance of Relay Environment configured with our network layer:
export default relayEnvironment;
