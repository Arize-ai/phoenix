import type { FC } from "react";

export interface ErrorBoundaryFallbackProps {
  error?: string | null;
  /** The value that was thrown, before it was reduced to its message. */
  thrown?: unknown;
}

export type ErrorBoundaryFallbackComponent = FC<ErrorBoundaryFallbackProps>;
