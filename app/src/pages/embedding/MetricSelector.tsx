import { Key, useCallback, useTransition } from "react";
import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Heading,
  Label,
  ListBox,
  Popover,
  RichTooltip,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { useInferences, usePointCloudContext } from "@phoenix/contexts";
import {
  DriftMetricDefinition,
  MetricDefinition,
  PerformanceMetricDefinition,
  RetrievalMetricDefinition,
} from "@phoenix/store";
import { assertUnreachable } from "@phoenix/typeUtils";

import {
  MetricSelector_dimensions$data,
  MetricSelector_dimensions$key,
} from "./__generated__/MetricSelector_dimensions.graphql";

/**
 * Delineates the tuple (or triple) of metric type and metric name
 */
const METRIC_KEY_SEPARATOR = ":";
/**
 * Type guard for MetricDefinition["type"]
 */
function isMetricType(
  maybeType: unknown
): maybeType is MetricDefinition["type"] {
  return ["drift", "performance", "dataQuality", "retrieval"].includes(
    maybeType as string
  );
}
/**
 * A function that flattens the metrics into a single key
 * E.x. "dataQuality:average:age"
 * @param {MetricDefinition} metric
 * @returns
 */
function getMetricKey(metric: MetricDefinition) {
  const { type, metric: metricName } = metric;
  switch (type) {
    case "drift":
      return `${type}${METRIC_KEY_SEPARATOR}${metricName}`;
    case "retrieval":
      return `${type}${METRIC_KEY_SEPARATOR}${metricName}`;
    case "performance":
      return `${type}${METRIC_KEY_SEPARATOR}${metricName}`;
    case "dataQuality": {
      const { name } = metric.dimension;
      return `${type}${METRIC_KEY_SEPARATOR}${metricName}${METRIC_KEY_SEPARATOR}${name}`;
    }
    default:
      assertUnreachable(type);
  }
}

type ParseMetricKeyParams = {
  metricKey: string;
  dimensions: MetricSelector_dimensions$data["numericDimensions"]["edges"][number]["node"][];
};
/**
 * Parses a metric key into a MetricDefinition
 * @param {string} metricKey
 * @returns {MetricDefinition} definition
 */
function parseMetricKey({
  metricKey,
  dimensions,
}: ParseMetricKeyParams): MetricDefinition {
  const [type, metricName, dimensionName] =
    metricKey.split(METRIC_KEY_SEPARATOR);
  if (!isMetricType(type)) {
    throw new Error(`Invalid metric type: ${type}`);
  }
  switch (type) {
    case "drift":
      return { type, metric: metricName as DriftMetricDefinition["metric"] };
    case "retrieval":
      return {
        type,
        metric: metricName as RetrievalMetricDefinition["metric"],
      };
    case "performance":
      return {
        type,
        metric: metricName as PerformanceMetricDefinition["metric"],
      };
    case "dataQuality": {
      const dimension = dimensions.find((d) => d.name === dimensionName);
      if (!dimension) {
        throw new Error(`Invalid dimension name: ${dimensionName}`);
      }
      return {
        type,
        metric: metricName as "average",
        dimension,
      };
    }
    default:
      assertUnreachable(type);
  }
}

const metricSelectorCSS = css`
  /* Align with other toolbar components */
  .react-aria-Button {
    height: 30px;
    min-height: 30px;
  }

  .react-aria-Label {
    padding: 5px 0;
    display: inline-block;
    font-size: var(--ac-global-dimension-static-font-size-75);
    font-weight: var(--px-font-weight-heavy);
  }
`;

export function MetricSelector({
  model,
}: {
  model: MetricSelector_dimensions$key;
}) {
  const [, startTransition] = useTransition();
  const data = useFragment<MetricSelector_dimensions$key>(
    graphql`
      fragment MetricSelector_dimensions on InferenceModel {
        numericDimensions: dimensions(include: { dataTypes: [numeric] }) {
          edges {
            node {
              id
              name
              type
            }
          }
        }
      }
    `,
    model
  );
  const { referenceInferences, corpusInferences } = useInferences();
  const hasReferenceInferences = !!referenceInferences;
  const hasCorpusInferences = !!corpusInferences;
  const metric = usePointCloudContext((state) => state.metric);
  const loading = usePointCloudContext((state) => state.loading);
  const setMetric = usePointCloudContext((state) => state.setMetric);
  const numericDimensions = data.numericDimensions.edges.map(
    (edge) => edge.node
  );
  const hasNumericDimensions = numericDimensions.length > 0;
  const onSelectionChange = useCallback(
    (key: Key | null) => {
      if (!key) {
        return;
      }
      const metricDefinition = parseMetricKey({
        metricKey: key as string,
        dimensions: numericDimensions,
      });
      startTransition(() => {
        setMetric(metricDefinition);
      });
    },
    [setMetric, numericDimensions, startTransition]
  );

  // Create a flat list of all available metrics
  const allMetrics = [];

  if (hasReferenceInferences) {
    allMetrics.push({
      key: getMetricKey({
        type: "drift",
        metric: "euclideanDistance",
      }),
      label: "Euclidean Distance",
    });
  }

  if (hasCorpusInferences) {
    allMetrics.push({
      key: getMetricKey({
        type: "retrieval",
        metric: "queryDistance",
      }),
      label: "Query Distance",
    });
  }

  allMetrics.push({
    key: getMetricKey({
      type: "performance",
      metric: "accuracyScore",
    }),
    label: "Accuracy Score",
  });

  if (hasNumericDimensions) {
    numericDimensions.forEach((dimension) => {
      allMetrics.push({
        key: getMetricKey({
          type: "dataQuality",
          metric: "average",
          dimension,
        }),
        label: `${dimension.name} avg`,
      });
    });
  }

  return (
    <TooltipTrigger delay={0}>
      <Select
        selectedKey={metric ? getMetricKey(metric) : undefined}
        onSelectionChange={onSelectionChange}
        placeholder="Select a metric..."
        isDisabled={loading}
        aria-label="Analysis metric"
        css={metricSelectorCSS}
      >
        <Label>Metric</Label>
        <Button>
          <SelectValue />
          <SelectChevronUpDownIcon />
        </Button>
        <Popover>
          <ListBox>
            {allMetrics.map((metric) => (
              <SelectItem key={metric.key} id={metric.key}>
                {metric.label}
              </SelectItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
      <RichTooltip>
        <TooltipArrow />
        <section
          css={css`
            h4 {
              margin-bottom: 0.5rem;
            }
          `}
        >
          <Heading level={4}>Analysis Metric</Heading>
          <Text>Select a metric to drive the analysis of your embeddings.</Text>
          <Text>
            To analyze the the drift between your two inferences, select a drift
            metric and the UI will highlight areas of high drift.
          </Text>
          <Text>
            To analyze the quality of your embeddings, select a dimension data
            quality metric by which to analyze the point cloud. The UI will
            highlight areas where the data quality is degrading.
          </Text>
        </section>
      </RichTooltip>
    </TooltipTrigger>
  );
}
