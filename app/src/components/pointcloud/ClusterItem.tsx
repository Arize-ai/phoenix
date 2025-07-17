import { useMemo } from "react";
import { css } from "@emotion/react";

import { Flex, Heading, Text } from "@phoenix/components";
import { InferencesRole } from "@phoenix/types";
import { numberFormatter } from "@phoenix/utils/numberFormatUtils";

type ClusterItemProps = {
  clusterId: string;
  /**
   * The number of points in the cluster
   */
  numPoints: number;
  /**
   * Whether the cluster is selected in the point cloud
   * @default false
   */
  isSelected?: boolean;
  /**
   * The callback to invoke when the cluster is clicked
   */
  onClick: () => void;
  /**
   * The callback for the mouse enter event
   */
  onMouseEnter?: () => void;
  /**
   * The callback for the mouse leave event
   */
  onMouseLeave?: () => void;
  /**
   * The ratio of the primary count / total count.
   * Null if there is no reference
   */
  driftRatio?: number | null;
  /**
   * The ratio of the primary inferences' count to the count of corpus points
   * Used to troubleshoot retrieval
   */
  primaryToCorpusRatio?: number | null;
  /**
   * The primary metric value
   */
  primaryMetricValue: number | null;
  /**
   * The reference metric value
   */
  referenceMetricValue: number | null;
  /**
   * The metric name
   */
  metricName: string;
  /**
   * Whether to hide the reference metric or not
   */
  hideReference: boolean;
};

/**
 * A UI component that displays a cluster and it's aggregate data
 */
export function ClusterItem(props: ClusterItemProps) {
  const {
    driftRatio,
    primaryToCorpusRatio,
    clusterId,
    isSelected,
    onClick,
    onMouseEnter,
    onMouseLeave,
    metricName,
    primaryMetricValue,
    referenceMetricValue,
    hideReference,
  } = props;

  // Calculate the percentage of primary points in the cluster

  const { percentage: primaryPercentage, comparisonInferencesRole } = useMemo<{
    percentage: number;
    comparisonInferencesRole: InferencesRole | null;
  }>(() => {
    if (typeof primaryToCorpusRatio === "number") {
      return {
        percentage: ((primaryToCorpusRatio + 1) / 2) * 100,
        comparisonInferencesRole: InferencesRole.corpus,
      };
    } else if (typeof driftRatio === "number") {
      return {
        percentage: ((driftRatio + 1) / 2) * 100,
        comparisonInferencesRole: InferencesRole.reference,
      };
    }
    return { percentage: 100, comparisonInferencesRole: null };
  }, [driftRatio, primaryToCorpusRatio]);
  return (
    <div
      css={css`
        border: 1px solid var(--ac-global-border-color-light);
        border-radius: var(--ac-global-rounding-medium);
        overflow: hidden;
        transition: background-color 0.2s ease-in-out;
        cursor: pointer;
        &:hover {
          background-color: var(--ac-global-color-primary-700);
          border-color: var(--ac-global-color-primary);
        }
        &.is-selected {
          border-color: var(--ac-global-color-primary);
          background-color: var(--ac-global-color-primary-700);
        }
      `}
      className={isSelected ? "is-selected" : ""}
      role="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        css={css`
          padding: var(--ac-global-dimension-static-size-100);
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
        `}
      >
        <Flex
          data-testid="cluster-description"
          direction="column"
          gap="size-50"
          alignItems="start"
        >
          <Flex direction="column" alignItems="start">
            <Heading level={3}>{`Cluster ${clusterId}`}</Heading>
            <Text
              color="text-700"
              size="XS"
            >{`${props.numPoints} points`}</Text>
          </Flex>
        </Flex>
        <div
          data-testid="cluster-metric"
          css={css`
            display: flex;
            flex-direction: column;
            align-items: end;
          `}
        >
          <Text color="text-700" size="XS">
            {metricName}
          </Text>
          <Text color="text-900" size="S">
            {numberFormatter(primaryMetricValue)}
          </Text>
          {!hideReference ? (
            <Text color="purple-800" size="XS">
              {numberFormatter(referenceMetricValue)}
            </Text>
          ) : null}
        </div>
      </div>
      <DistributionBar
        primaryPercentage={primaryPercentage}
        comparisonInferencesRole={comparisonInferencesRole}
      />
    </div>
  );
}

function DistributionBar({
  primaryPercentage,
  comparisonInferencesRole,
}: {
  primaryPercentage: number;
  comparisonInferencesRole?: InferencesRole | null;
}) {
  return (
    <div
      data-testid="inferences-distribution"
      css={css`
        display: flex;
        flex-direction: row;
      `}
    >
      <div
        data-testid="primary-distribution"
        css={css`
          background-image: linear-gradient(
            to right,
            var(--px-primary-color--transparent) 0%,
            var(--px-primary-color)
          );
          height: var(--px-gradient-bar-height);
          width: ${primaryPercentage}%;
        `}
      />
      <div
        data-testid="reference-distribution"
        data-reference-inferences-role={`${comparisonInferencesRole ?? "none"}`}
        css={css`
          &[data-reference-inferences-role="reference"] {
            background-image: linear-gradient(
              to right,
              var(--px-reference-color) 0%,
              var(--px-reference-color--transparent)
            );
          }
          &[data-reference-inferences-role="corpus"] {
            background-image: linear-gradient(
              to right,
              var(--px-corpus-color) 0%,
              var(--px-corpus-color--transparent)
            );
          }

          height: var(--px-gradient-bar-height);
          width: ${100 - primaryPercentage}%;
        `}
      />
    </div>
  );
}
