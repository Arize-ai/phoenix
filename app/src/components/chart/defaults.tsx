import { transparentize } from "polished";
import { ReferenceLineProps, TooltipProps, XAxisProps } from "recharts";

import { theme } from "@arizeai/components";

/**
 * Re-usable default props for the XAxis component.
 */
export const defaultTimeXAxisProps: XAxisProps = {
  dataKey: "timestamp",
  stroke: "var(--ac-global-colo-grey-400)",
  style: { fill: "var(--ac-global-text-color-700)" },
  scale: "time",
  type: "number",
  domain: ["auto", "auto"],
  padding: "gap",
};

export const defaultSelectedTimestampReferenceLineProps: ReferenceLineProps = {
  stroke: "var(--ac-global-color-grey-900)",
  label: {
    value: "▼",
    position: "top",
    style: {
      fill: "#fabe32",
      fontSize: theme.typography.sizes.small.fontSize,
    },
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultBarChartTooltipProps: TooltipProps<any, any> = {
  cursor: {
    fill: "var(--ac-global-color-grey-300)",
  },
};
