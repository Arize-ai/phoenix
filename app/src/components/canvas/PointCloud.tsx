import React, { ReactNode, useMemo, useState } from "react";
import {
  ThreeDimensionalCanvas,
  ThreeDimensionalControls,
  getThreeDimensionalBounds,
  ThreeDimensionalBounds,
  LassoSelect,
  ColorSchemes,
  Cluster,
} from "@arizeai/point-cloud";
import { theme } from "@arizeai/components";
import { css } from "@emotion/react";
import { ControlPanel } from "./ControlPanel";
import { ColoringStrategyPicker } from "./ColoringStrategyPicker";
import { CanvasMode, CanvasModeRadioGroup } from "./CanvasModeRadioGroup";
import { PointCloudPoints } from "./PointCloudPoints";
import { ThreeDimensionalPointItem } from "./types";
import { ColoringStrategy, ClusterItem } from "./types";
import { createColorFn } from "./coloring";

export type PointCloudProps = {
  primaryData: ThreeDimensionalPointItem[];
  referenceData: ThreeDimensionalPointItem[] | null;
  clusters: readonly ClusterItem[];
  /**
   * The id of the cluster that is currently selected
   */
  selectedClusterId: string | null;
};

const CONTROL_PANEL_WIDTH = 300;
const DEFAULT_COLOR_SCHEME = ColorSchemes.Discrete2.WhiteLightBlue;
/**
 * Displays the tools available on the point cloud
 * E.g. move vs select
 */
function CanvasTools(props: {
  coloringStrategy: ColoringStrategy;
  onColoringStrategyChange: (strategy: ColoringStrategy) => void;
  canvasMode: CanvasMode;
  onCanvasModeChange: (mode: CanvasMode) => void;
}) {
  const {
    coloringStrategy,
    onColoringStrategyChange,
    canvasMode,
    onCanvasModeChange,
  } = props;
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
      <ColoringStrategyPicker
        strategy={coloringStrategy}
        onChange={onColoringStrategyChange}
      />
      <CanvasModeRadioGroup mode={canvasMode} onChange={onCanvasModeChange} />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SelectionControlPanel({ selectedIds }: { selectedIds: Set<string> }) {
  return (
    <ControlPanel position="top-right" width={CONTROL_PANEL_WIDTH}>
      <ul>
        {[...selectedIds].map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
    </ControlPanel>
  );
}

function CanvasWrap({ children }: { children: ReactNode }) {
  return (
    <div
      css={css`
        flex: 1 1 auto;
        position: relative;
      `}
    >
      {children}
    </div>
  );
}

export function PointCloud({
  primaryData,
  referenceData,
  clusters,
  selectedClusterId,
}: PointCloudProps) {
  // AutoRotate the canvas on initial load
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [coloringStrategy, onColoringStrategyChange] =
    useState<ColoringStrategy>(ColoringStrategy.dataset);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>(CanvasMode.move);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allPoints = useMemo(() => {
    return [...primaryData, ...(referenceData || [])];
  }, []);

  // Keep a map of point id to position for fast lookup
  const pointPositionsMap = useMemo(() => {
    return allPoints.reduce((acc, point) => {
      acc[(point.metaData as any).id as string] = point.position;
      return acc;
    }, {} as Record<string, ThreeDimensionalPointItem["position"]>);
  }, [allPoints]);

  const bounds = useMemo(() => {
    return getThreeDimensionalBounds(allPoints.map((p) => p.position));
  }, []);

  const isMoveMode = canvasMode === CanvasMode.move;

  // Determine the color of the points based on the strategy
  const primaryColor = createColorFn({
    coloringStrategy,
    defaultColor: DEFAULT_COLOR_SCHEME[0],
  });
  const referenceColor = createColorFn({
    coloringStrategy,
    defaultColor: DEFAULT_COLOR_SCHEME[1],
  });

  // Interleave the cluster point locations with the cluster
  const clustersWithData = useMemo(() => {
    return clusters.map((cluster) => {
      const { pointIds } = cluster;
      return {
        ...cluster,
        data: pointIds.map((pointId) => ({
          position: pointPositionsMap[pointId],
        })),
      };
    });
  }, [pointPositionsMap]);
  return (
    <CanvasWrap>
      {/* <SelectionControlPanel selectedIds={selectedIds} /> */}
      <CanvasTools
        coloringStrategy={coloringStrategy}
        onColoringStrategyChange={onColoringStrategyChange}
        canvasMode={canvasMode}
        onCanvasModeChange={setCanvasMode}
      />
      <ThreeDimensionalCanvas camera={{ position: [0, 0, 10] }}>
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
        <ThreeDimensionalBounds bounds={bounds}>
          <LassoSelect
            points={allPoints}
            onChange={(selection) => {
              setSelectedIds(new Set(selection.map((s) => s.metaData.id)));
            }}
            enabled={canvasMode === CanvasMode.select}
          />

          <PointCloudPoints
            primaryData={primaryData}
            referenceData={referenceData}
            selectedIds={selectedIds}
            primaryColor={primaryColor}
            referenceColor={referenceColor}
          />
          {clustersWithData.map((cluster) => (
            <Cluster
              key={cluster.id}
              data={cluster.data}
              opacity={cluster.id === selectedClusterId ? 0.2 : 0}
              wireframe
            />
          ))}
        </ThreeDimensionalBounds>
      </ThreeDimensionalCanvas>
    </CanvasWrap>
  );
}
