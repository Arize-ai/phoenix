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

const seriesDatumSchema = z.object({
  label: z.string(),
  values: z.array(chartDatumSchema),
});

const chartCardPropsSchema = z.object({
  title: z.string(),
  subtitle: z.string().nullish(),
});

const stackPropsSchema = z.object({
  gap: z.enum(["xs", "sm", "md", "lg"]).nullish(),
});

const rowPropsSchema = z.object({
  gap: z.enum(["xs", "sm", "md", "lg"]).nullish(),
});

const titlePropsSchema = z.object({
  text: z.string(),
});

const paragraphPropsSchema = z.object({
  text: z.string(),
});

const metricPropsSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  change: z.string().nullish(),
});

const chartPropsSchema = z.object({
  title: z.string().nullish(),
  data: z.array(chartDatumSchema),
});

const multiSeriesChartPropsSchema = z.object({
  title: z.string().nullish(),
  series: z.array(seriesDatumSchema),
});

const generatedUIElementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ChartCard"),
    props: chartCardPropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("Stack"),
    props: stackPropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("Row"),
    props: rowPropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("Title"),
    props: titlePropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("Paragraph"),
    props: paragraphPropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("Metric"),
    props: metricPropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("BarChart"),
    props: chartPropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("LineChart"),
    props: chartPropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("PieChart"),
    props: chartPropsSchema,
    children: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("MultiSeriesChart"),
    props: multiSeriesChartPropsSchema,
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
    ChartCard: {
      props: chartCardPropsSchema,
      slots: ["default"],
      description:
        "Card container for generated analysis, metrics, and charts.",
    },
    Stack: {
      props: stackPropsSchema,
      slots: ["default"],
      description: "Vertical layout for grouping generated UI components.",
    },
    Row: {
      props: rowPropsSchema,
      slots: ["default"],
      description: "Horizontal wrapping layout for metrics or chart summaries.",
    },
    Title: {
      props: titlePropsSchema,
      description: "Section heading text.",
    },
    Paragraph: {
      props: paragraphPropsSchema,
      description: "Short explanatory paragraph.",
    },
    Metric: {
      props: metricPropsSchema,
      description: "Single KPI or aggregate value with optional change text.",
    },
    BarChart: {
      props: chartPropsSchema,
      description: "Simple categorical bar chart with label/value points.",
    },
    LineChart: {
      props: chartPropsSchema,
      description: "Simple trend chart with ordered label/value points.",
    },
    PieChart: {
      props: chartPropsSchema,
      description: "Simple proportional chart with label/value slices.",
    },
    MultiSeriesChart: {
      props: multiSeriesChartPropsSchema,
      description: "Simple placeholder for comparing multiple labeled series.",
    },
  },
  actions: {},
});

export const generativeUICatalogPrompt = generativeUICatalog.prompt({
  customRules: [
    "Use ChartCard as the root for chart-like responses.",
    "Prefer Metric, BarChart, LineChart, PieChart, and MultiSeriesChart for quantitative answers.",
    `Use the ${GENERATIVE_UI_TOOL_NAME} tool when a generated UI would answer the user better than prose alone.`,
  ],
});
