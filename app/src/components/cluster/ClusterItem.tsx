import React from "react";

import { css } from "@emotion/react";

type ClusterItemProps = {
  clusterId: string;
  /**
   * The number of points in the cluster
   */
  numPoints: number;
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
      `}
    >
      <div
        css={(theme) => css`
          padding: ${theme.spacing.padding8}px;
        `}
      >
        <h3>{`Cluster ${props.clusterId}`}</h3>
        <span>{`${props.numPoints} points`}</span>
      </div>
      <div
        data-testid="dataset-distribution"
        css={css`
          background-color: var(--px-primary-color);
          height: 8px;
        `}
      />
    </div>
  );
}
