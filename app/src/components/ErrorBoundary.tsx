import React, { ReactNode } from "react";
import { css } from "@emotion/react";

import { EmptyGraphic, Flex, View } from "@arizeai/components";

import { ExternalLink } from "./ExternalLink";
type ErrorBoundaryProps = { children: ReactNode };
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { hasError: boolean; error: unknown }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(_error: unknown, _errorInfo: unknown) {
    // You can also log the error to an error reporting service
    //   logErrorToMyService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <View padding="size-200">
          <Flex direction="column">
            <Flex direction="column" width="100%" alignItems="center">
              <EmptyGraphic graphicKey="error" />
              <h1>Something went wrong</h1>
            </Flex>
            <p>
              We strive to do our very best but 🐛 bugs happen. It would mean a
              lot to us if you could file a an issue. If you feel comfortable,
              please include the error details below in your issue. We will get
              back to you as soon as we can.
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
                {this.state.error instanceof Error
                  ? this.state.error.message
                  : null}
              </pre>
            </details>
          </Flex>
        </View>
      );
    }

    return this.props.children;
  }
}
