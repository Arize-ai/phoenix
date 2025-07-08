import { ReferenceLineProps, TooltipProps, XAxisProps } from "recharts";

/**
 * Re-usable default props for the XAxis component.
 */
export const defaultTimeXAxisProps: XAxisProps = {
  dataKey: "timestamp",
  stroke: "var(--ac-global-color-grey-400)",
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
      fontSize: "var(--ac-global-font-size-xs)",
    },
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultBarChartTooltipProps: TooltipProps<any, any> = {
  cursor: {
    // intense color turned weak by opacity
    // in order to let grid lines show through
    fill: "var(--ac-global-color-grey-400)",
    fillOpacity: 0.2,
  },
};
