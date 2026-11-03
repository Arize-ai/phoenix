import { css } from "@emotion/react";

import { ExternalLink } from "../core/ExternalLink";
import { Flex } from "../core/layout";
import { View } from "../core/view";
import { classifyServerConnectionError } from "./serverConnectionError";
import { ServerConnectionErrorContent } from "./ServerConnectionErrorContent";
import type { ErrorBoundaryFallbackProps } from "./types";

const errorDetailsCSS = css`
  white-space: pre-wrap;
  overflow-wrap: break-word;
  overflow: hidden;
  overflow-y: auto;
  max-height: 500px;
`;

export function BugReportErrorBoundaryFallback({
  error,
  thrown,
}: ErrorBoundaryFallbackProps) {
  const connectionErrorKind = classifyServerConnectionError(thrown);
  if (connectionErrorKind != null) {
    return (
      <View padding="size-200">
        <Flex direction="column">
          <ServerConnectionErrorContent kind={connectionErrorKind} />
          {error && (
            <details>
              <summary>error details</summary>
              <pre css={errorDetailsCSS}>{error}</pre>
            </details>
          )}
        </Flex>
      </View>
    );
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
          <pre css={errorDetailsCSS}>{error}</pre>
        </details>
      </Flex>
    </View>
  );
}
