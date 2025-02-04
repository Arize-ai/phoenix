import React from "react";

import { useTheme } from "@phoenix/contexts";

export type GenerativeProviderIconProps = {
  provider: ModelProvider;
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
  let providerKey: string = provider.toLowerCase();
  if (provider === "AZURE_OPENAI") {
    providerKey = "azure";
  }
  return (
    <picture>
      <source
        media={`(prefers-color-scheme: ${theme})`}
        srcSet={`https://unpkg.com/@lobehub/icons-static-png@latest/dark/${providerKey}.png`}
      />
      <img
        height={height}
        src={`https://unpkg.com/@lobehub/icons-static-png@latest/light/${providerKey}.png`}
      />
    </picture>
  );
}
