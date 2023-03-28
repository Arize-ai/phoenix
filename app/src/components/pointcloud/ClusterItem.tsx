import React from "react";
import { transparentize } from "polished";
import { css } from "@emotion/react";

import { Heading, Text } from "@arizeai/components";

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
  } = props;

  const hasClusterMetric = driftRatio !== null;
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
        `}
      >
        <div
          data-testid="cluster-description"
          css={(theme) => css`
            display: flex;
            flex-direction: column;
            gap: ${theme.spacing.margin4}px;
          `}
        >
          <Heading level={3}>{`Cluster ${clusterId}`}</Heading>
          <Text color="white70" textSize="small">
            {`${props.numPoints} points`}
          </Text>
        </div>
        {hasClusterMetric ? (
          <div
            data-testid="cluster-metric"
            css={(theme) => css`
              text-align: right;
              display: flex;
              flex-direction: column;
              gap: ${theme.spacing.margin4}px;
            `}
          >
            <Text color="white90" textSize="large">
              {driftRatio?.toPrecision(2) ?? "--"}
            </Text>
            <Text color="white70" textSize="small">
              Cluster Drift
            </Text>
          </div>
        ) : null}
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
