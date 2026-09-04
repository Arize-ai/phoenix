import { useTheme } from "@phoenix/contexts";

import { getSpanKindColor } from "./spanKindColor";

/**
 * Returns the appropriate color for a span kind as defined by openinference.
 *
 * Derives from the shared span kind base color so that timeline bars, icons,
 * and tokens all read as one visual system. In dark mode the base is
 * lightened (matching the SpanKindIcon glyph); in light mode the base -500
 * colors are already vibrant mid-tones, and darkening them turns the warm
 * hues (orange, yellow) muddy.
 */
export function useSpanKindColor({ spanKind }: { spanKind: string }) {
  const { theme } = useTheme();
  const baseColor = getSpanKindColor({ spanKind });
  return theme === "dark" ? `lch(from ${baseColor} 85 c h)` : baseColor;
}
