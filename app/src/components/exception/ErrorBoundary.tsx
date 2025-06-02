import { Component, ReactNode } from "react";

import { BugReportErrorBoundaryFallback } from "./BugReportErrorBoundaryFallback";
import { ErrorBoundaryFallbackComponent } from "./types";
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

  componentDidCatch(_error: unknown, _errorInfo: unknown) {
    // You can also log the error to an error reporting service
    //   logErrorToMyService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
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
