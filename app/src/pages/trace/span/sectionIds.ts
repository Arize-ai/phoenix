import type { SpanInfoSectionKey } from "./types";

/** Returns the stable DOM id for a span's top-level information section. */
export function getSpanInfoSectionId({
  sectionKey,
  spanId,
}: {
  sectionKey: SpanInfoSectionKey;
  spanId: string;
}): string {
  return `span-details-${spanId}-${sectionKey.replaceAll(/([A-Z])/g, "-$1").toLowerCase()}`;
}
