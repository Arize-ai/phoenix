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
};
export class ErrorBoundary extends Component<
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
