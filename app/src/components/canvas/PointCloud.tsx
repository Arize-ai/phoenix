import React, { useMemo, useState } from "react";
import {
  ThreeDimensionalCanvas,
  ThreeDimensionalControls,
  getThreeDimensionalBounds,
  ThreeDimensionalBounds,
  LassoSelect,
  ColorSchemes,
} from "@arizeai/point-cloud";
import { ErrorBoundary } from "../ErrorBoundary";
import { theme } from "@arizeai/components";
import { css } from "@emotion/react";
import { ControlPanel } from "./ControlPanel";
import { ColoringStrategyPicker } from "./ColoringStrategyPicker";
import { CanvasMode, CanvasModeRadioGroup } from "./CanvasModeRadioGroup";
import { PointCloudPoints } from "./PointCloudPoints";
import { ThreeDimensionalPointItem } from "./types";
import { ColoringStrategy } from "./types";
import { createColorFn } from "./coloring";

export type PointCloudProps = {
  primaryData: ThreeDimensionalPointItem[];
  referenceData?: ThreeDimensionalPointItem[];
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

export function PointCloud({ primaryData, referenceData }: PointCloudProps) {
  // AutoRotate the canvas on initial load
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [coloringStrategy, onColoringStrategyChange] =
    useState<ColoringStrategy>(ColoringStrategy.dataset);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>(CanvasMode.move);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allPoints = useMemo(() => {
    return [...primaryData, ...(referenceData || [])];
  }, []);
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
  return (
    <ErrorBoundary>
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
        </ThreeDimensionalBounds>
      </ThreeDimensionalCanvas>
    </ErrorBoundary>
  );
}
