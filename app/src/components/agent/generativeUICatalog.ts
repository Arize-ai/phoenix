import { defineCatalog, SPEC_DATA_PART_TYPE } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

export const JSON_RENDER_DATA_PART_TYPE = SPEC_DATA_PART_TYPE;
export const LEGACY_JSON_RENDER_DATA_PART_TYPE = "data-json-render";
export const GENERATIVE_UI_TOOL_NAME = "render_generated_ui";

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
  segments: z.array(stackedBarSegmentSchema),
});

const lineSeriesSchema = z.object({
  label: z.string().nullish(),
  data: z.array(z.number()),
});

const barChartPropsSchema = z.object({
  title: z.string().nullish(),
  data: z.array(chartDatumSchema),
});

const verticalBarChartPropsSchema = z.object({
  title: z.string().nullish(),
  data: z.array(verticalBarDatumSchema),
  baseLabel: z.string().nullish(),
  highlightLabel: z.string().nullish(),
});

const stackedBarChartPropsSchema = z.object({
  title: z.string().nullish(),
  data: z.array(stackedBarDatumSchema),
});

const lineChartPropsSchema = z.object({
  title: z.string().nullish(),
  lines: z.array(lineSeriesSchema),
  xLabels: z.array(z.string()).nullish(),
});

const generatedUIElementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("BarChart"),
    props: barChartPropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("VerticalBarChart"),
    props: verticalBarChartPropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("StackedBarChart"),
    props: stackedBarChartPropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("LineChart"),
    props: lineChartPropsSchema,
    children: z.array(z.string()).optional(),
  }),
]);

export const renderGeneratedUISpecSchema = z
  .object({
    root: z.string(),
    elements: z.record(z.string(), generatedUIElementSchema),
  })
  .refine((spec) => spec.root in spec.elements, {
    message: "Generated UI root must reference an element.",
    path: ["root"],
  })
  .refine(
    (spec) =>
      Object.values(spec.elements).every((element) =>
        (element.children ?? []).every((childId) => childId in spec.elements)
      ),
    {
      message: "Generated UI children must reference existing elements.",
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
        "Compact vertical bar chart for time buckets, optionally with highlighted counts stacked on top of a base value.",
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

export const generativeUICatalogPrompt = generativeUICatalog.prompt({
  customRules: [
    "Use one chart component as the root of each generated UI call.",
    "Prefer BarChart, VerticalBarChart, StackedBarChart, and LineChart for quantitative answers.",
    `Use the ${GENERATIVE_UI_TOOL_NAME} tool when a generated UI would answer the user better than prose alone.`,
  ],
});
