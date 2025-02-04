import React from "react";

import { useTheme } from "@phoenix/contexts";

export type GenerativeProviderIconProps = {
  provider: "openai" | "anthropic" | "gemini" | "azure";
  height?: number;
};

/**
 * A component that renders an icon for a generative provider
 */
export function GenerativeProviderIcon({
  provider,
  height = 18,
}: GenerativeProviderIconProps) {
  const { theme } = useTheme();
  return (
    <picture>
      <source
        media={`(prefers-color-scheme: ${theme})`}
        srcSet={`https://unpkg.com/@lobehub/icons-static-png@latest/dark/${provider}.png`}
      />
      <img
        height={height}
        src={`https://unpkg.com/@lobehub/icons-static-png@latest/light/${provider}.png`}
      />
    </picture>
  );
}
