import { css } from "@emotion/react";

import { Text } from "../content";
import { Icon, Icons } from "../icon";
import type { ErrorBoundaryFallbackProps } from "./types";

/**
 * An error boundary fallback that displays the text "error"
 * To be used in small UI components where you don't want to destroy the layout
 */
export function TextErrorBoundaryFallback(_props: ErrorBoundaryFallbackProps) {
  return (
    <div
      css={css`
        text-align: center;
        display: flex;
        color: var(--global-text-color-300);
        gap: var(--global-dimension-size-50);
      `}
    >
      <Icon svg={<Icons.AlertCircleOutline />} />
      <Text color="text-300">error</Text>
    </div>
  );
}
