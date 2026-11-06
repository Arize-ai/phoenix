import { defineRegistry, type ComponentRenderer } from "@json-render/react";

import { generativeUICatalog } from "../generativeUICatalog";
import { BarChart } from "./BarChart";
import { GenerativeUIPlaceholder } from "./GenerativeUIPlaceholder";
import { LineChart } from "./LineChart";
import { StackedBarChart } from "./StackedBarChart";
import { VerticalBarChart } from "./VerticalBarChart";

export const { registry: generativeUIRegistry } = defineRegistry(
  generativeUICatalog,
  {
    components: {
      BarChart: ({ props }) => (
        <BarChart title={props.title ?? null} data={props.data} />
      ),
      VerticalBarChart: ({ props }) => (
        <VerticalBarChart
          title={props.title ?? null}
          data={props.data}
          baseLabel={props.baseLabel}
          highlightLabel={props.highlightLabel}
        />
      ),
      StackedBarChart: ({ props }) => (
        <StackedBarChart title={props.title ?? null} data={props.data} />
      ),
      LineChart: ({ props }) => (
        <LineChart
          title={props.title ?? null}
          lines={props.lines}
          xLabels={props.xLabels}
        />
      ),
    },
  }
);

export const UnknownGenerativeElement: ComponentRenderer = ({ element }) => (
  <GenerativeUIPlaceholder
    message={`Unsupported generative UI element: ${element.type}`}
  />
);
