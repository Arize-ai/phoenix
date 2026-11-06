import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

/**
 * Recharts handles a positive `debounce` value as a trailing resize throttle.
 * Fifty milliseconds keeps compact charts responsive during a drag while
 * preventing ResizeObserver-driven render cycles from running every frame.
 */
const CHART_RESIZE_DEBOUNCE_MS = 50;

/**
 * Shared responsive container for charts that fill a {@link ChartPanel}.
 */
export function ChartResponsiveContainer({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      debounce={CHART_RESIZE_DEBOUNCE_MS}
    >
      {children}
    </ResponsiveContainer>
  );
}
