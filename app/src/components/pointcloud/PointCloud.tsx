import React, { ReactNode, useCallback, useMemo, useState } from "react";
import { useContextBridge } from "@react-three/drei";
import { css } from "@emotion/react";

import { theme } from "@arizeai/components";
import {
  Axes,
  getThreeDimensionalBounds,
  LassoSelect,
  PointBaseProps,
  ThreeDimensionalBounds,
  ThreeDimensionalCanvas,
  ThreeDimensionalControls,
} from "@arizeai/point-cloud";

import { UNKNOWN_COLOR } from "@phoenix/constants/pointCloudConstants";
import { PointCloudContext, usePointCloudContext } from "@phoenix/contexts";

import { CanvasMode, CanvasModeRadioGroup } from "./CanvasModeRadioGroup";
import { PointCloudClusters } from "./PointCloudClusters";
import { PointCloudPoints } from "./PointCloudPoints";
import { ThreeDimensionalPointItem } from "./types";
import { ClusterInfo } from "./types";

const RADIUS_BOUNDS_3D_DIVISOR = 400;
const CLUSTER_POINT_RADIUS_MULTIPLIER = 6;
const BOUNDS_3D_ZOOM_PADDING_FACTOR = 0.2;

export interface PointCloudProps {
  primaryData: ThreeDimensionalPointItem[];
  referenceData: ThreeDimensionalPointItem[] | null;
  clusters: readonly ClusterInfo[];
}

interface ProjectionProps extends PointCloudProps {
  canvasMode: CanvasMode;
}

const CONTROL_PANEL_WIDTH = 300;
/**
 * Displays the tools available on the point cloud
 * E.g. move vs select
 */
function CanvasTools(props: {
  canvasMode: CanvasMode;
  onCanvasModeChange: (mode: CanvasMode) => void;
}) {
  const { canvasMode, onCanvasModeChange } = props;
  return (
    <div
      css={css`
        position: absolute;
        /* left: ${CONTROL_PANEL_WIDTH + 2 * theme.spacing.margin8}px; */
        left: ${theme.spacing.margin8}px;
        top: ${theme.spacing.margin8}px;
        z-index: 1;
        display: flex;
        flex-direction: row;
        gap: ${theme.spacing.margin8}px;
      `}
    >
      <CanvasModeRadioGroup mode={canvasMode} onChange={onCanvasModeChange} />
    </div>
  );
}

function CanvasWrap({ children }: { children: ReactNode }) {
  return (
    <div
      css={css`
        flex: 1 1 auto;
        height: 100%;
        position: relative;
        background-color: black;
      `}
    >
      {children}
    </div>
  );
}

export function PointCloud(props: PointCloudProps) {
  const [canvasMode, setCanvasMode] = useState<CanvasMode>(CanvasMode.move);

  return (
    <CanvasWrap>
      <CanvasTools canvasMode={canvasMode} onCanvasModeChange={setCanvasMode} />
      <Projection canvasMode={canvasMode} {...props} />
    </CanvasWrap>
  );
}

function Projection(props: ProjectionProps) {
  const { primaryData, referenceData, clusters, canvasMode } = props;

  const selectedPointIds = usePointCloudContext(
    (state) => state.selectedPointIds
  );
  const setSelectedPointIds = usePointCloudContext(
    (state) => state.setSelectedPointIds
  );
  const selectedClusterId = usePointCloudContext(
    (state) => state.selectedClusterId
  );
  const setSelectedClusterId = usePointCloudContext(
    (state) => state.setSelectedClusterId
  );
  const pointGroupColors = usePointCloudContext(
    (state) => state.pointGroupColors
  );
  const pointGroupVisibility = usePointCloudContext(
    (state) => state.pointGroupVisibility
  );

  // AutoRotate the canvas on initial load
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  const allPoints = useMemo(() => {
    return [...primaryData, ...(referenceData || [])];
  }, [primaryData, referenceData]);

  const bounds = useMemo(() => {
    return getThreeDimensionalBounds(allPoints.map((p) => p.position));
  }, [allPoints]);

  const radius =
    (bounds.maxX - bounds.minX + (bounds.maxY - bounds.minY)) /
    2 /
    RADIUS_BOUNDS_3D_DIVISOR;

  const clusterPointRadius = radius * CLUSTER_POINT_RADIUS_MULTIPLIER;

  const isMoveMode = canvasMode === CanvasMode.move;

  const pointIdToGroup = usePointCloudContext((state) => state.pointIdToGroup);

  // Color the points by their corresponding group
  const colorFn = useCallback(
    (point: PointBaseProps) => {
      // Always fallback to unknown
      const group = pointIdToGroup[point.metaData.id] || "unknown";
      return pointGroupColors[group] || UNKNOWN_COLOR;
    },
    [pointGroupColors, pointIdToGroup]
  );

  // Filter the points by the group visibility
  const filteredPrimaryData = useMemo(() => {
    return primaryData.filter((point) => {
      const group = pointIdToGroup[point.metaData.id];
      return pointGroupVisibility[group];
    });
  }, [primaryData, pointIdToGroup, pointGroupVisibility]);

  const filteredReferenceData = useMemo(() => {
    if (!referenceData) {
      return null;
    }
    return referenceData.filter((point) => {
      const group = pointIdToGroup[point.metaData.id];
      return pointGroupVisibility[group];
    });
  }, [referenceData, pointIdToGroup, pointGroupVisibility]);

  // Context cannot be passed through multiple reconcilers. Bridge the context
  const ContextBridge = useContextBridge(PointCloudContext);

  return (
    <ThreeDimensionalCanvas camera={{ position: [0, 0, 10] }}>
      <ContextBridge>
        <ThreeDimensionalControls
          autoRotate={autoRotate}
          autoRotateSpeed={2}
          enableRotate={isMoveMode}
          enablePan={isMoveMode}
          onEnd={() => {
            // Turn off auto rotate when the user interacts with the canvas
            setAutoRotate(false);
          }}
        />
        <ThreeDimensionalBounds
          bounds={bounds}
          boundsZoomPaddingFactor={BOUNDS_3D_ZOOM_PADDING_FACTOR}
        >
          <LassoSelect
            points={allPoints}
            onChange={(selection) => {
              setSelectedPointIds(new Set(selection.map((s) => s.metaData.id)));
              setSelectedClusterId(null);
            }}
            enabled={canvasMode === CanvasMode.select}
          />
          <Axes size={(bounds.maxX - bounds.minX) / 4} />
          <PointCloudPoints
            primaryData={filteredPrimaryData}
            referenceData={filteredReferenceData}
            selectedIds={selectedPointIds}
            color={colorFn}
            radius={radius}
          />
          <PointCloudClusters
            clusters={clusters}
            points={allPoints}
            selectedClusterId={selectedClusterId}
            radius={clusterPointRadius}
          />
        </ThreeDimensionalBounds>
      </ContextBridge>
    </ThreeDimensionalCanvas>
  );
}
