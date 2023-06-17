import React from "react";
import { transparentize } from "polished";
import { css } from "@emotion/react";

import { Flex, Heading, Text } from "@arizeai/components";

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
  const primaryPercentage =
    typeof driftRatio === "number" ? ((driftRatio + 1) / 2) * 100 : 100;
  return (
    <div
      css={(theme) => css`
        border: 1px solid ${theme.colors.gray400};
        border-radius: 4px;
        overflow: hidden;
        transition: background-color 0.2s ease-in-out;
        cursor: pointer;
        &:hover {
          background-color: ${transparentize(0.9, theme.colors.arizeLightBlue)};
          border-color: ${transparentize(0.5, theme.colors.arizeLightBlue)};
        }
        &.is-selected {
          border-color: ${theme.colors.arizeLightBlue};
          background-color: ${transparentize(0.8, theme.colors.arizeLightBlue)};
        }
      `}
      className={isSelected ? "is-selected" : ""}
      role="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        css={(theme) => css`
          padding: ${theme.spacing.padding8}px;
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
              color="white70"
              textSize="small"
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
          <Text color="white70" textSize="small">
            {metricName}
          </Text>
          <Text color="white90" textSize="medium">
            {numberFormatter(primaryMetricValue)}
          </Text>
          {!hideReference ? (
            <Text color="designationPurple" textSize="small">
              {numberFormatter(referenceMetricValue)}
            </Text>
          ) : null}
        </div>
      </div>
      <DistributionBar primaryPercentage={primaryPercentage} />
    </div>
  );
}

function DistributionBar({ primaryPercentage }: { primaryPercentage: number }) {
  return (
    <div
      data-testid="dataset-distribution"
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
        css={css`
          background-image: linear-gradient(
            to right,
            var(--px-reference-color) 0%,
            var(--px-reference-color--transparent)
          );
          height: var(--px-gradient-bar-height);
          width: ${100 - primaryPercentage}%;
        `}
      />
    </div>
  );
}
