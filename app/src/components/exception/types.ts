import { FC } from "react";

export interface ErrorBoundaryFallbackProps {
  error?: string | null;
}

export type ErrorBoundaryFallbackComponent = FC<ErrorBoundaryFallbackProps>;
