import { css } from "@emotion/react";

import { Button } from "../core/button";
import { Flex } from "../core/layout";

/**
 * Explains a connection timeout and offers a retry.
 *
 * Owns the wording and the shape of the explanation; the consumer owns the
 * surrounding chrome, so the same explanation reads the same way on the
 * route-level error page and inside a panel that also shows error details.
 */
export function ServerConnectionErrorContent() {
  return (
    <>
      <Flex direction="column" width="100%" alignItems="center">
        <h1>Connection timed out</h1>
      </Flex>
      <p>
        The connection to the Phoenix server timed out before a response was
        received. This typically happens when a load balancer or proxy closes
        the connection before the server can respond.
      </p>
      <p>Possible solutions:</p>
      <ul
        css={css`
          margin: var(--global-dimension-size-100) 0;
          padding-left: var(--global-dimension-size-300);
        `}
      >
        <li>Increase your load balancer or proxy timeout settings</li>
        <li>Check if the Phoenix server is overloaded or slow to respond</li>
        <li>Verify network connectivity between components</li>
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
