import { css } from "@emotion/react";
import { Tooltip, TooltipTrigger } from "react-aria-components";

import { Text } from "../core/content";
import { Icon, Icons } from "../core/icon";
import { View } from "../core/view";
import type { ErrorBoundaryFallbackProps } from "./types";

/**
 * An error boundary fallback that displays the text "error"
 * To be used in small UI components where you don't want to destroy the layout.
 * Hover to see the underlying error message.
 */
export function TextErrorBoundaryFallback({
  error,
}: ErrorBoundaryFallbackProps) {
  const content = (
    <div
      css={css`
        text-align: center;
        display: inline-flex;
        align-items: center;
        color: var(--global-text-color-300);
        gap: var(--global-dimension-size-50);
        cursor: ${error ? "help" : "default"};
      `}
    >
      <Icon svg={<Icons.AlertCircle />} />
      <Text color="text-300">error</Text>
    </div>
  );

  if (!error) {
    return content;
  }

  return (
    <TooltipTrigger delay={200}>
      <span tabIndex={0}>{content}</span>
      <Tooltip offset={6}>
        <View
          padding="size-100"
          borderColor="default"
          borderWidth="thin"
          borderRadius="small"
          backgroundColor="gray-200"
          maxWidth="size-4600"
        >
          <pre
            css={css`
              white-space: pre-wrap;
              overflow-wrap: break-word;
              margin: 0;
              font-size: var(--global-font-size-xs, 12px);
            `}
          >
            {error}
          </pre>
        </View>
      </Tooltip>
    </TooltipTrigger>
  );
}
