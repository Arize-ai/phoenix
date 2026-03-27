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

import { isObject } from "./typeUtils";

const graphQLPath = BASE_URL + "/graphql";

const isAuthenticationEnabled = window.Config.authenticationEnabled;
const graphQLFetch = isAuthenticationEnabled ? authFetch : fetch;
type ObservableSink<T> = {
  complete: () => void;
  error: (error: Error) => void;
  next: (value: T) => void;
};

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
        if (!isMultipartMixed(contentType)) {
          return response.json().then((data) => {
            const error = hasErrors?.(data);
            if (error) {
              throw error;
            }
            sink.next(data as T);
            sink.complete();
          });
        }
        await streamMultipartResponse({ response, sink });
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

function isMultipartMixed(contentType: string | null): boolean {
  return contentType?.toLowerCase().includes("multipart/mixed") ?? false;
}

function getMultipartBoundary(contentType: string): string {
  const boundaryMatch = contentType.match(/boundary="?([^=";]+)"?/i);
  invariant(boundaryMatch?.[1], "multipart response is missing a boundary");
  return boundaryMatch[1];
}

function findHeadersEnd(
  buffer: string,
  searchStart: number
): {
  index: number;
  delimiterLength: number;
} | null {
  const crlfIndex = buffer.indexOf("\r\n\r\n", searchStart);
  if (crlfIndex !== -1) {
    return { index: crlfIndex, delimiterLength: 4 };
  }
  const lfIndex = buffer.indexOf("\n\n", searchStart);
  if (lfIndex !== -1) {
    return { index: lfIndex, delimiterLength: 2 };
  }
  return null;
}

function findNextBoundary(
  buffer: string,
  boundaryMarker: string,
  searchStart: number
): number {
  const boundaryAtLineStart = buffer.indexOf(
    `\r\n${boundaryMarker}`,
    searchStart
  );
  const boundaryAtLfLineStart = buffer.indexOf(
    `\n${boundaryMarker}`,
    searchStart
  );
  const candidateIndices = [boundaryAtLineStart, boundaryAtLfLineStart].filter(
    (value) => value !== -1
  );
  if (candidateIndices.length === 0) {
    return -1;
  }
  return Math.min(...candidateIndices);
}

async function streamMultipartResponse<T>({
  response,
  sink,
}: {
  response: Response;
  sink: ObservableSink<T>;
}): Promise<void> {
  invariant(response.body, "multipart response body is missing");
  const contentType = response.headers.get("Content-Type");
  invariant(contentType, "multipart response is missing a content type");

  const boundary = getMultipartBoundary(contentType);
  const boundaryMarker = `--${boundary}`;
  const closingBoundaryMarker = `${boundaryMarker}--`;
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";

  const emitAvailableParts = (): boolean => {
    while (true) {
      const firstBoundaryIndex = buffer.indexOf(boundaryMarker);
      if (firstBoundaryIndex === -1) {
        return false;
      }
      if (firstBoundaryIndex > 0) {
        buffer = buffer.slice(firstBoundaryIndex);
      }
      if (
        buffer === closingBoundaryMarker ||
        buffer.startsWith(`${closingBoundaryMarker}\r\n`)
      ) {
        sink.complete();
        return true;
      }
      if (buffer.startsWith(`${closingBoundaryMarker}\n`)) {
        sink.complete();
        return true;
      }

      const boundaryLineEndIndex = buffer.search(/\r?\n/);
      if (boundaryLineEndIndex === -1) {
        return false;
      }

      const boundaryLine = buffer.slice(0, boundaryLineEndIndex);
      if (boundaryLine === closingBoundaryMarker) {
        sink.complete();
        return true;
      }

      const lineBreakLength = buffer.startsWith("\r\n", boundaryLineEndIndex)
        ? 2
        : 1;
      const headersStart = boundaryLineEndIndex + lineBreakLength;
      const headersEnd = findHeadersEnd(buffer, headersStart);
      if (!headersEnd) {
        return false;
      }

      const bodyStart = headersEnd.index + headersEnd.delimiterLength;
      const nextBoundaryIndex = findNextBoundary(
        buffer,
        boundaryMarker,
        bodyStart
      );
      if (nextBoundaryIndex === -1) {
        return false;
      }

      const body = buffer.slice(bodyStart, nextBoundaryIndex).trim();
      if (body) {
        sink.next(JSON.parse(body) as T);
      }

      const boundaryPrefixLength = buffer.startsWith("\r\n", nextBoundaryIndex)
        ? 2
        : 1;
      buffer = buffer.slice(nextBoundaryIndex + boundaryPrefixLength);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    if (emitAvailableParts()) {
      return;
    }
    if (done) {
      break;
    }
  }

  buffer += decoder.decode();
  if (!emitAvailableParts()) {
    throw new Error(
      "multipart response terminated before a complete GraphQL payload was received"
    );
  }
}

/**
 * Relay requires developers to configure a "fetch" function that tells Relay how to load
 * the results of GraphQL queries from your server (or other data source). See more at
 * https://relay.dev/docs/en/quick-start-guide#relay-environment.
 */
const fetchRelay: FetchFunction = (params, variables, _cacheConfig) =>
  fetchGraphQLObservable(
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
