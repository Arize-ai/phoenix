import { defineRegistry, type ComponentRenderer } from "@json-render/react";

import { generativeUICatalog } from "../generativeUICatalog";
import { BarChart } from "./BarChart";
import { ChartCard } from "./ChartCard";
import { GeneratedUIPlaceholder } from "./GeneratedUIPlaceholder";
import { LineChart } from "./LineChart";
import { Metric } from "./Metric";
import { MultiSeriesChart } from "./MultiSeriesChart";
import { Paragraph } from "./Paragraph";
import { PieChart } from "./PieChart";
import { Row } from "./Row";
import { Stack } from "./Stack";
import { Title } from "./Title";

export const { registry: generativeUIRegistry } = defineRegistry(
  generativeUICatalog,
  {
    components: {
      ChartCard: ({ props, children }) => (
        <ChartCard title={props.title} subtitle={props.subtitle ?? null}>
          {children}
        </ChartCard>
      ),
      Stack: ({ props, children }) => (
        <Stack gap={props.gap ?? null}>{children}</Stack>
      ),
      Row: ({ props, children }) => (
        <Row gap={props.gap ?? null}>{children}</Row>
      ),
      Title: ({ props }) => <Title text={props.text} />,
      Paragraph: ({ props }) => <Paragraph text={props.text} />,
      Metric: ({ props }) => (
        <Metric
          label={props.label}
          value={props.value}
          change={props.change ?? null}
        />
      ),
      BarChart: ({ props }) => (
        <BarChart title={props.title ?? null} data={props.data} />
      ),
      LineChart: ({ props }) => (
        <LineChart title={props.title ?? null} data={props.data} />
      ),
      PieChart: ({ props }) => (
        <PieChart title={props.title ?? null} data={props.data} />
      ),
      MultiSeriesChart: ({ props }) => (
        <MultiSeriesChart title={props.title ?? null} series={props.series} />
      ),
    },
  }
);

export const UnknownGeneratedElement: ComponentRenderer = ({ element }) => (
  <GeneratedUIPlaceholder
    message={`Unsupported generated UI element: ${element.type}`}
  />
);
