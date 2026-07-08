import { defineCatalog, SPEC_DATA_PART_TYPE } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

export const JSON_RENDER_DATA_PART_TYPE = SPEC_DATA_PART_TYPE;
export const LEGACY_JSON_RENDER_DATA_PART_TYPE = "data-json-render";
export const GENERATIVE_UI_TOOL_NAME = "render_generative_ui";

// Bar charts disallow single visualizations
// At most 12 rows, at most 4 segments
const HORIZONTAL_BAR_CHART_ITEM_COUNT = { min: 2, max: 12 };
const HORIZONTAL_BAR_CHART_SEGMENT_COUNT = { min: 2, max: 4 };
// At most 12 columns, "segments" handled by single optional "highlight" arg
const VERTICAL_BAR_CHART_ITEM_COUNT = { min: 2, max: 12 };
const LINE_CHART_SERIES_COUNT = { min: 1, max: 4 };

const chartDatumSchema = z.object({
  label: z.string(),
  value: z.number(),
});

const verticalBarDatumSchema = z.object({
  label: z.string(),
  value: z.number(),
  highlight: z.number().nullish(),
});

const stackedBarSegmentSchema = z.object({
  label: z.string(),
  value: z.number(),
});

const stackedBarDatumSchema = z.object({
  label: z.string(),
  segments: z
    .array(stackedBarSegmentSchema)
    .min(HORIZONTAL_BAR_CHART_SEGMENT_COUNT.min)
    .max(HORIZONTAL_BAR_CHART_SEGMENT_COUNT.max),
});

const lineSeriesSchema = z.object({
  label: z.string().nullish(),
  data: z.array(z.number()),
});

const leafChildrenSchema = z.array(z.never()).max(0).optional();

const barChartPropsSchema = z.object({
  title: z.string().nullish(),
  data: z
    .array(chartDatumSchema)
    .min(HORIZONTAL_BAR_CHART_ITEM_COUNT.min)
    .max(HORIZONTAL_BAR_CHART_ITEM_COUNT.max),
});

const verticalBarChartPropsSchema = z.object({
  title: z.string().nullish(),
  data: z
    .array(verticalBarDatumSchema)
    .min(VERTICAL_BAR_CHART_ITEM_COUNT.min)
    .max(VERTICAL_BAR_CHART_ITEM_COUNT.max),
  baseLabel: z.string().nullish(),
  highlightLabel: z.string().nullish(),
});

const stackedBarChartPropsSchema = z.object({
  title: z.string().nullish(),
  data: z
    .array(stackedBarDatumSchema)
    .min(HORIZONTAL_BAR_CHART_ITEM_COUNT.min)
    .max(HORIZONTAL_BAR_CHART_ITEM_COUNT.max),
});

const lineChartPropsSchema = z.object({
  title: z.string().nullish(),
  lines: z
    .array(lineSeriesSchema)
    .min(LINE_CHART_SERIES_COUNT.min)
    .max(LINE_CHART_SERIES_COUNT.max),
  xLabels: z.array(z.string()).nullish(),
});

const generativeUIElementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("BarChart"),
    props: barChartPropsSchema,
    children: leafChildrenSchema,
  }),
  z.object({
    type: z.literal("VerticalBarChart"),
    props: verticalBarChartPropsSchema,
    children: leafChildrenSchema,
  }),
  z.object({
    type: z.literal("StackedBarChart"),
    props: stackedBarChartPropsSchema,
    children: leafChildrenSchema,
  }),
  z.object({
    type: z.literal("LineChart"),
    props: lineChartPropsSchema,
    children: leafChildrenSchema,
  }),
]);

export const renderGenerativeUISpecSchema = z
  .object({
    root: z.string(),
    elements: z.record(z.string(), generativeUIElementSchema),
  })
  .refine((spec) => spec.root in spec.elements, {
    message: "Generative UI root must reference an element.",
    path: ["root"],
  })
  .refine(
    (spec) =>
      Object.values(spec.elements).every((element) =>
        (element.children ?? []).every((childId) => childId in spec.elements)
      ),
    {
      message: "Generative UI children must reference existing elements.",
      path: ["elements"],
    }
  );

export const generativeUICatalog = defineCatalog(schema, {
  components: {
    BarChart: {
      props: barChartPropsSchema,
      description: "Horizontal categorical bar chart with label/value rows.",
    },
    VerticalBarChart: {
      props: verticalBarChartPropsSchema,
      description:
        "Compact vertical bar chart for time buckets, optionally with one highlighted segment stacked on top of the base value.",
    },
    StackedBarChart: {
      props: stackedBarChartPropsSchema,
      description:
        "Horizontal stacked bar chart for comparing segment totals across categories.",
    },
    LineChart: {
      props: lineChartPropsSchema,
      description:
        "Compact multi-line trend chart with optional series labels and x-axis labels.",
    },
  },
  actions: {},
});

export const generativeUICatalogPrompt = generativeUICatalog.prompt();
