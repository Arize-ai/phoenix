import { createClient, Sink } from "graphql-ws";
import {
  Environment,
  FetchFunction,
  GraphQLResponse,
  Network,
  Observable,
  RecordSource,
  RequestParameters,
  Store,
  SubscribeFunction,
  Variables,
} from "relay-runtime";

import { authFetch } from "@phoenix/authFetch";
import { BASE_URL, WS_BASE_URL } from "@phoenix/config";

const graphQLPath = BASE_URL + "/graphql";

const graphQLFetch = window.Config.authenticationEnabled ? authFetch : fetch;

/**
 * Relay requires developers to configure a "fetch" function that tells Relay how to load
 * the results of GraphQL queries from your server (or other data source). See more at
 * https://relay.dev/docs/en/quick-start-guide#relay-environment.
 */
const fetchRelay: FetchFunction = async (params, variables, _cacheConfig) => {
  const response = await graphQLFetch(graphQLPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: params.text,
      variables,
    }),
  });

  // Get the response as JSON
  const json = await response.json();

  // GraphQL returns exceptions (for example, a missing required variable) in the "errors"
  // property of the response. If any exceptions occurred when processing the request,
  // throw an error to indicate to the developer what went wrong.
  if (Array.isArray(json.errors)) {
    throw new Error(
      `Error fetching GraphQL query '${
        params.name
      }' with variables '${JSON.stringify(variables)}': ${JSON.stringify(
        json.errors
      )}`
    );
  }

  // Otherwise, return the full payload.
  return json;
};

/**
 * Check whether or not we are running
 */
const wsClient = createClient({
  url: `${WS_BASE_URL}/graphql`,
});

const subscribe: SubscribeFunction = (
  operation: RequestParameters,
  variables: Variables
) => {
  return Observable.create<GraphQLResponse>((sink) => {
    return wsClient.subscribe(
      {
        operationName: operation.name,
        query: operation.text as string,
        variables,
      },
      sink as Sink
    );
  });
};

// Export a singleton instance of Relay Environment configured with our network layer:
export default new Environment({
  network: Network.create(fetchRelay, subscribe),
  store: new Store(new RecordSource(), {
    // This property tells Relay to not immediately clear its cache when the user
    // navigates around the app. Relay will hold onto the specified number of
    // query results, allowing the user to return to recently visited pages
    // and reusing cached data if its available/fresh.
    gcReleaseBufferSize: 10,
  }),
});
