import { css } from "@emotion/react";

import { Button, ExternalLink, Flex, View } from "@phoenix/components";

import { isConnectionTimeoutError } from "./isConnectionTimeoutError";
import { ErrorBoundaryFallbackProps } from "./types";

export function BugReportErrorBoundaryFallback({
  error,
}: ErrorBoundaryFallbackProps) {
  // Check if this is a connection timeout error
  if (isConnectionTimeoutError(error)) {
    return <ConnectionTimeoutFallback error={error} />;
  }

  return (
    <View padding="size-200">
      <Flex direction="column">
        <Flex direction="column" width="100%" alignItems="center">
          <h1>Something went wrong</h1>
        </Flex>
        <p>
          We strive to do our very best but 🐛 bugs happen. It would mean a lot
          to us if you could file a an issue. If you feel comfortable, please
          include the error details below in your issue. We will get back to you
          as soon as we can.
        </p>

        <Flex direction="row" width="100%" justifyContent="end">
          <ExternalLink href="https://github.com/Arize-ai/phoenix/issues/new?assignees=&labels=bug&template=bug_report.md&title=%5BBUG%5D">
            file an issue with us
          </ExternalLink>
        </Flex>
        <details open>
          <summary>error details</summary>
          <pre
            css={css`
              white-space: pre-wrap;
              overflow-wrap: break-word;
              overflow: hidden;
              overflow-y: auto;
              max-height: 500px;
            `}
          >
            {error}
          </pre>
        </details>
      </Flex>
    </View>
  );
}

function ConnectionTimeoutFallback({
  error,
}: {
  error: string | null | undefined;
}) {
  return (
    <View padding="size-200">
      <Flex direction="column">
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
            margin: var(--ac-global-dimension-static-size-100) 0;
            padding-left: var(--ac-global-dimension-static-size-300);
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
        {error && (
          <details>
            <summary>error details</summary>
            <pre
              css={css`
                white-space: pre-wrap;
                overflow-wrap: break-word;
                overflow: hidden;
                overflow-y: auto;
                max-height: 500px;
              `}
            >
              {error}
            </pre>
          </details>
        )}
      </Flex>
    </View>
  );
}
