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
};
/**
 * A UI component that displays a cluster and it's aggregate data
 */
export function ClusterItem(props: ClusterItemProps) {
  return (
    <div
      css={(theme) => css`
        border: 1px solid ${theme.colors.gray400};
        border-radius: 4px;
        overflow: hidden;
        transition: background-color 0.2s ease-in-out;

        &:hover {
          background-color: ${transparentize(0.9, theme.colors.arizeLightBlue)};
          border-color: ${transparentize(0.5, theme.colors.arizeLightBlue)};
        }
        &.is-selected {
          border-color: ${theme.colors.arizeLightBlue};
          background-color: ${transparentize(0.8, theme.colors.arizeLightBlue)};
        }
      `}
      className={props.isSelected ? "is-selected" : ""}
      role="button"
      onClick={props.onClick}
    >
      <div
        css={(theme) => css`
          padding: ${theme.spacing.padding8}px;
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
          <Heading level={3}>{`Cluster ${props.clusterId}`}</Heading>
          <Text color="white70" textSize="small">
            {`${props.numPoints} points`}
          </Text>
        </div>
      </div>
      <div
        data-testid="dataset-distribution"
        css={css`
          background-image: linear-gradient(
            to right,
            var(--px-primary-color--transparent) 0%,
            var(--px-primary-color)
          );
          height: var(--px-gradient-bar-height);
        `}
      />
    </div>
  );
}
