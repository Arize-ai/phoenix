import type { ReactNode } from "react";
import { Component } from "react";

import {
  isRedirectingToLogin,
  isRedirectingToLoginError,
} from "@phoenix/authFetch";

import { BugReportErrorBoundaryFallback } from "./BugReportErrorBoundaryFallback";
import type { ErrorBoundaryFallbackComponent } from "./types";
type ErrorBoundaryProps = {
  children: ReactNode;
  /**
   * The fallback component that gets displayed when the error occurs.
   * @default BugReportErrorBoundaryFallback
   */
  fallback?: ErrorBoundaryFallbackComponent;
  /**
   * Clears a caught error when changed without remounting healthy children.
   */
  resetKey?: string;
};
type ErrorBoundaryState = {
  hasError: boolean;
  error: unknown;
  resetKey: string | undefined;
};
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: unknown) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey === state.resetKey) {
      return null;
    }
    return { hasError: false, error: null, resetKey: props.resetKey };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (
        isRedirectingToLoginError(this.state.error) ||
        isRedirectingToLogin()
      ) {
        // The browser is already navigating to the login page; render nothing
        // rather than an error while the handoff completes. The flag check
        // also covers errors from fetches interrupted by that navigation,
        // which some browsers reject with a generic error rather than an
        // AbortError.
        return null;
      }
      const errorMessage: string | null =
        this.state.error instanceof Error ? this.state.error.message : null;
      return typeof this.props.fallback === "function" ? (
        <this.props.fallback error={errorMessage} />
      ) : (
        <BugReportErrorBoundaryFallback error={errorMessage} />
      );
    }

    return this.props.children;
  }
}
