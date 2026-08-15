import { createFetchMultipartSubscription } from "@apollo/client/utilities/subscriptions/relay";
import type { FetchFunction } from "relay-runtime";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import invariant from "tiny-invariant";

import { authFetch } from "@phoenix/authFetch";
import { BASE_URL } from "@phoenix/config";

import {
  instrumentRelayEnvironment,
  isRelayDebugEnabled,
} from "./relayDebugInstrumentation";
import { isObject } from "./typeUtils";

const graphQLPath = BASE_URL + "/graphql";

const isAuthenticationEnabled = window.Config.authenticationEnabled;
const graphQLFetch = isAuthenticationEnabled ? authFetch : fetch;

// The maximum number of characters of a failed response body to include in an
// error message. Large enough to clear the boilerplate <head> of a CSS-heavy
// gateway error page and reach the actual error, small enough to stay readable.
const ERROR_BODY_SNIPPET_LENGTH = 1000;

/**
 * Create an observable that fetches JSON from the given input and returns an error if
 * the data has errors.
 *
 * The observable aborts in-flight network requests when the unsubscribe function is
 * called.
 *
 * @param input - The input to fetch from.
 * @param init - The request init options.
 * @param hasErrors - A function that returns an error if the data has errors.
 * @returns An observable that emits the data or an error.
 */
function fetchJsonObservable<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  hasErrors?: (data: unknown) => Error | undefined
): Observable<T> {
  return Observable.create((sink) => {
    const controller = new AbortController();

    graphQLFetch(input, { ...init, signal: controller.signal })
      .then(async (response) => {
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
            throw new Error(
              `GraphQL request failed: the server returned an empty response (status ${response.status} ${response.statusText}).`
            );
          }
          // The body is likely an HTML error page from a gateway or proxy.
          // Include a snippet to make the failure easier to diagnose.
          const snippet = text.slice(0, ERROR_BODY_SNIPPET_LENGTH);
          throw new Error(
            `GraphQL request failed: the server returned a non-JSON response (status ${response.status} ${response.statusText}): ${snippet}`
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
          const snippet = JSON.stringify(data).slice(
            0,
            ERROR_BODY_SNIPPET_LENGTH
          );
          throw new Error(
            `GraphQL request failed with status ${response.status} ${response.statusText}: ${snippet}`
          );
        }
        return data;
      })
      .then((data) => {
        const error = hasErrors?.(data);
        if (error) {
          throw error;
        }
        sink.next(data as T);
        sink.complete();
      })
      .catch((error) => {
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
      // abort the fetch request when the observable is unsubscribed
      controller.abort();
    };
  });
}

/**
 * Relay requires developers to configure a "fetch" function that tells Relay how to load
 * the results of GraphQL queries from your server (or other data source). See more at
 * https://relay.dev/docs/en/quick-start-guide#relay-environment.
 */
const fetchRelay: FetchFunction = (params, variables, _cacheConfig) =>
  fetchJsonObservable(
    graphQLPath,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
        return new Error(
          `Error fetching GraphQL query '${params.name}' with variables '${JSON.stringify(
            variables
          )}': ${JSON.stringify(data.errors)}`
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
