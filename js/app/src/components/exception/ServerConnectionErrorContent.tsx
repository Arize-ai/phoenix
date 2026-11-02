import { css } from "@emotion/react";

import { Button } from "../core/button";
import { Flex } from "../core/layout";
import type { ServerConnectionErrorKind } from "./serverConnectionError";

const COPY: Record<
  ServerConnectionErrorKind,
  { title: string; description: string; solutions: readonly string[] }
> = {
  timeout: {
    title: "Connection timed out",
    description:
      "The connection to the Phoenix server timed out before a response was received. This usually means a load balancer or proxy closed the connection while waiting for the server to respond.",
    solutions: [
      "Increase your load balancer or proxy timeout settings",
      "Check whether the Phoenix server is overloaded or slow to respond",
      "Verify network connectivity between components",
    ],
  },
  unavailable: {
    title: "Phoenix is unavailable",
    description:
      "Phoenix or an intermediary returned an error instead of a response, so the request could not be completed.",
    solutions: [
      "Check whether the Phoenix server is running and healthy",
      "Check the health and upstream configuration of any load balancer or proxy",
      "Retry after the service has recovered",
    ],
  },
};

/**
 * Explains a failed GraphQL response and offers a retry.
 *
 * Owns the wording and the shape of the explanation; the consumer owns the
 * surrounding chrome, so the same explanation reads the same way on the
 * route-level error page and inside a panel that also shows error details.
 */
export function ServerConnectionErrorContent({
  kind,
}: {
  kind: ServerConnectionErrorKind;
}) {
  const { title, description, solutions } = COPY[kind];

  return (
    <>
      <Flex direction="column" width="100%" alignItems="center">
        <h1>{title}</h1>
      </Flex>
      <p>{description}</p>
      <p>Possible solutions:</p>
      <ul
        css={css`
          margin: var(--global-dimension-size-100) 0;
          padding-left: var(--global-dimension-size-300);
        `}
      >
        {solutions.map((solution) => (
          <li key={solution}>{solution}</li>
        ))}
      </ul>
      <Flex direction="row" width="100%" justifyContent="end">
        <Button
          variant="primary"
          size="S"
          onPress={() => {
            window.location.reload();
          }}
        >
          Retry
        </Button>
      </Flex>
    </>
  );
}
