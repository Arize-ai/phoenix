import { createFetchMultipartSubscription } from "@apollo/client/utilities/subscriptions/relay";
import type { FetchFunction, GraphQLResponse } from "relay-runtime";
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
import { readMultipartBody } from "@phoenix/graphql/http";

import { isObject } from "./typeUtils";

const graphQLPath = BASE_URL + "/graphql";

const isAuthenticationEnabled = window.Config.authenticationEnabled;
const graphQLFetch = isAuthenticationEnabled ? authFetch : fetch;

/**
 * Check whether a Content-Type header indicates a multipart/mixed response,
 * which is what the server returns for @defer/@stream operations.
 */
function isMultipartMixed(contentType: string | null): boolean {
  return contentType?.toLowerCase().includes("multipart/mixed") ?? false;
}

/**
 * Create an observable that fetches GraphQL from the given input.
 *
 * The fetcher supports both the traditional single JSON response and multipart
 * incremental responses used by GraphQL @defer.
 *
 * The observable aborts in-flight network requests when the unsubscribe function is
 * called.
 *
 * @param input - The input to fetch from.
 * @param init - The request init options.
 * @param hasErrors - A function that returns an error if the data has errors.
 * @returns An observable that emits the data or an error.
 */
function fetchGraphQLObservable<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  hasErrors?: (data: unknown) => Error | undefined
): Observable<T> {
  return Observable.create((sink) => {
    const controller = new AbortController();

    graphQLFetch(input, { ...init, signal: controller.signal })
      .then(async (response) => {
        invariant(response instanceof Response, "response must be a Response");
        const contentType = response.headers.get("Content-Type");
        if (isMultipartMixed(contentType)) {
          // For @defer/@stream multipart responses, parse each part and
          // emit it to Relay individually.
          await readMultipartBody<T & object>(response, sink.next.bind(sink));
        } else {
          // Standard single JSON response
          const data = await response.json();
          const error = hasErrors?.(data);
          if (error) {
            throw error;
          }
          sink.next(data as T);
        }
      })
      .then(() => {
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
  fetchGraphQLObservable<GraphQLResponse>(
    graphQLPath,
    {
      method: "POST",
      headers: {
        Accept:
          "application/graphql-response+json, multipart/mixed; deferSpec=20220824, application/json",
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
        return;
      }
      if (Array.isArray(data.errors)) {
        return new Error(
          `Error fetching GraphQL query '${params.name}' with variables '${JSON.stringify(
            variables
          )}': ${JSON.stringify(data.errors)}`
        );
      }
    }
  );

const subscribe = createFetchMultipartSubscription(graphQLPath, {
  fetch: graphQLFetch,
});

// Export a singleton instance of Relay Environment configured with our network layer:
export default new Environment({
  network: Network.create(fetchRelay, subscribe),
  store: new Store(new RecordSource(), {
    // This property tells Relay to not immediately clear its cache when the user
    // navigates around the app. Relay will hold onto the specified number of
    // query results, allowing the user to return to recently visited pages
    // and reusing cached data if its available/fresh.
    gcReleaseBufferSize: 20,
  }),
});
