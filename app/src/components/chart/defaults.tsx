import { transparentize } from "polished";
import { ReferenceLineProps, TooltipProps, XAxisProps } from "recharts";

import { theme } from "@arizeai/components";

/**
 * Re-usable default props for the XAxis component.
 */
export const defaultTimeXAxisProps: XAxisProps = {
  dataKey: "timestamp",
  stroke: theme.colors.gray200,
  style: { fill: theme.textColors.text - 700 },
  scale: "time",
  type: "number",
  domain: ["auto", "auto"],
  padding: "gap",
};

export const defaultSelectedTimestampReferenceLineProps: ReferenceLineProps = {
  stroke: "white",
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
    fill: transparentize(0.3, theme.colors.gray200),
  },
};
