import React, { ReactNode, useCallback, useMemo, useState } from "react";
import { useContextBridge } from "@react-three/drei";
import { css } from "@emotion/react";

import {
  ActionTooltip,
  Button,
  Heading,
  Icon,
  InfoOutline,
  TooltipTrigger,
} from "@arizeai/components";
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
import { useTimeSlice } from "@phoenix/contexts/TimeSliceContext";
import { CanvasMode } from "@phoenix/store";
import { splitEventIdsByDataset } from "@phoenix/utils/pointCloudUtils";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import { CanvasModeRadioGroup } from "./CanvasModeRadioGroup";
import { CanvasThemeToggle } from "./CanvasThemeToggle";
import { PointCloudClusters } from "./PointCloudClusters";
import { PointCloudPoints } from "./PointCloudPoints";
import { ThreeDimensionalPointItem } from "./types";

const RADIUS_BOUNDS_3D_DIVISOR = 300;
const CLUSTER_POINT_RADIUS_MULTIPLIER = 6;
const BOUNDS_3D_ZOOM_PADDING_FACTOR = 0.2;

export interface PointCloudProps {
  primaryData: ThreeDimensionalPointItem[];
  referenceData: ThreeDimensionalPointItem[] | null;
}

interface ProjectionProps extends PointCloudProps {
  canvasMode: CanvasMode;
}

/**
 * Displays what is loaded in the point cloud
 */
function PointCloudInfo() {
  const { selectedTimestamp } = useTimeSlice();
  const points = usePointCloudContext((state) => state.points);
  const hdbscanParameters = usePointCloudContext(
    (state) => state.hdbscanParameters
  );
  const umapParameters = usePointCloudContext((state) => state.umapParameters);
  const [numPrimary, numReference] = useMemo(() => {
    const { primaryEventIds, referenceEventIds } = splitEventIdsByDataset(
      points.map((point) => point.eventId)
    );
    return [primaryEventIds.length, referenceEventIds.length];
  }, [points]);

  if (!selectedTimestamp) {
    return null;
  }
  return (
    <section
      css={css`
        width: 300px;
        padding: var(--px-spacing-med);
      `}
    >
      <dl css={descriptionListCSS}>
        <div>
          <dt>Timestamp</dt>
          <dd>{fullTimeFormatter(selectedTimestamp)}</dd>
        </div>

        <div>
          <dt>primary points</dt>
          <dd>{numPrimary}</dd>
        </div>
        {numReference > 0 ? (
          <div>
            <dt>reference points</dt>
            <dd>{numReference}</dd>
          </div>
        ) : null}
      </dl>
      <br />
      <Heading level={4} weight="heavy">
        Clustering Parameters
      </Heading>
      <dl css={descriptionListCSS}>
        <div>
          <dt>min cluster size</dt>
          <dd>{hdbscanParameters.minClusterSize}</dd>
        </div>
        <div>
          <dt>cluster min samples</dt>
          <dd>{hdbscanParameters.clusterMinSamples}</dd>
        </div>
        <div>
          <dt>cluster selection epsilon</dt>
          <dd>{hdbscanParameters.clusterSelectionEpsilon}</dd>
        </div>
      </dl>
      <br />
      <Heading level={4} weight="heavy">
        UMAP Parameters
      </Heading>
      <dl css={descriptionListCSS}>
        <div>
          <dt>min distance</dt>
          <dd>{umapParameters.minDist}</dd>
        </div>
        <div>
          <dt>n neighbors</dt>
          <dd>{umapParameters.nNeighbors}</dd>
        </div>
        <div>
          <dt>n samples per dataset</dt>
          <dd>{umapParameters.nSamples}</dd>
        </div>
      </dl>
    </section>
  );
}

const descriptionListCSS = css`
  margin: 0;
  padding: 0;
  div {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--px-spacing-sm);
  }
`;

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
        left: var(--px-spacing-med);
        top: var(--px-spacing-med);
        z-index: 1;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--px-spacing-med);
      `}
    >
      <CanvasModeRadioGroup mode={canvasMode} onChange={onCanvasModeChange} />
      <CanvasThemeToggle />
    </div>
  );
}

/**
 * Displays info about the canvas
 */
function CanvasInfo() {
  return (
    <div
      css={css`
        position: absolute;
        right: var(--px-spacing-med);
        top: var(--px-spacing-med);
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--px-spacing-med);
      `}
    >
      <TooltipTrigger placement="left top" delay={0}>
        <Button
          variant="default"
          size="compact"
          icon={<Icon svg={<InfoOutline />} />}
          aria-label="Information bout the point-cloud display"
        />
        <ActionTooltip title={"Point Cloud Summary"}>
          <PointCloudInfo />
        </ActionTooltip>
      </TooltipTrigger>
    </div>
  );
}

function CanvasWrap({ children }: { children: ReactNode }) {
  const canvasTheme = usePointCloudContext((state) => state.canvasTheme);
  return (
    <div
      css={css`
        flex: 1 1 auto;
        height: 100%;
        position: relative;
        &[data-theme="dark"] {
          background: linear-gradient(
            rgb(21, 25, 31) 11.4%,
            rgb(11, 12, 14) 70.2%
          );
        }
        &[data-theme="light"] {
          background: linear-gradient(#d2def3 0%, #b2c5e8 74%);
        }
      `}
      data-theme={canvasTheme}
    >
      {children}
    </div>
  );
}

export function PointCloud(props: PointCloudProps) {
  const canvasMode = usePointCloudContext((state) => state.canvasMode);
  const setCanvasMode = usePointCloudContext((state) => state.setCanvasMode);

  return (
    <CanvasWrap>
      <CanvasTools
        key="canvas-tools"
        canvasMode={canvasMode}
        onCanvasModeChange={setCanvasMode}
      />
      <Projection key="projection" canvasMode={canvasMode} {...props} />
      <CanvasInfo key="canvas-info" />
    </CanvasWrap>
  );
}

function Projection(props: ProjectionProps) {
  const { primaryData, referenceData, canvasMode } = props;

  const setSelectedEventIds = usePointCloudContext(
    (state) => state.setSelectedEventIds
  );
  const highlightedClusterId = usePointCloudContext(
    (state) => state.highlightedClusterId
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
  const canvasTheme = usePointCloudContext((state) => state.canvasTheme);
  const datasetVisibility = usePointCloudContext(
    (state) => state.datasetVisibility
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

  const eventIdToGroup = usePointCloudContext((state) => state.eventIdToGroup);

  // Color the points by their corresponding group
  const colorFn = useCallback(
    (point: PointBaseProps) => {
      // Always fallback to unknown
      const group = eventIdToGroup[point.metaData.eventId] || "unknown";
      return pointGroupColors[group] || UNKNOWN_COLOR;
    },
    [pointGroupColors, eventIdToGroup]
  );

  // Filter the points by the group visibility
  const filteredPrimaryData = useMemo(() => {
    return primaryData.filter((point) => {
      const group = eventIdToGroup[point.metaData.eventId];
      return pointGroupVisibility[group];
    });
  }, [primaryData, eventIdToGroup, pointGroupVisibility]);

  const filteredReferenceData = useMemo(() => {
    if (!referenceData) {
      return null;
    }
    return referenceData.filter((point) => {
      const group = eventIdToGroup[point.metaData.eventId];
      return pointGroupVisibility[group];
    });
  }, [referenceData, eventIdToGroup, pointGroupVisibility]);

  // Keep track of all the points in the view, minus the ones filtered out by visibility controls
  const allVisiblePoints = useMemo(() => {
    const visiblePrimaryPoints = datasetVisibility.primary
      ? filteredPrimaryData
      : [];
    const visibleReferencePoints = datasetVisibility.reference
      ? filteredReferenceData
      : [];
    const visiblePoints = [
      ...visiblePrimaryPoints,
      ...(visibleReferencePoints || []),
    ];
    return visiblePoints;
  }, [filteredPrimaryData, filteredReferenceData, datasetVisibility]);

  // Context cannot be passed through multiple reconcilers. Bridge the context
  const ContextBridge = useContextBridge(PointCloudContext);

  return (
    <ThreeDimensionalCanvas camera={{ position: [3, 3, 3] }}>
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
            points={allVisiblePoints}
            onChange={(selection) => {
              setSelectedEventIds(
                new Set(selection.map((s) => s.metaData.eventId))
              );
              setSelectedClusterId(null);
            }}
            enabled={canvasMode === CanvasMode.select}
          />
          <Axes
            size={(bounds.maxX - bounds.minX) / 4}
            color={canvasTheme == "dark" ? "#fff" : "#505050"}
          />

          <PointCloudPoints
            primaryData={filteredPrimaryData}
            referenceData={filteredReferenceData}
            color={colorFn}
            radius={radius}
          />
          <PointCloudClusters
            highlightedClusterId={highlightedClusterId}
            selectedClusterId={selectedClusterId}
            radius={clusterPointRadius}
          />
        </ThreeDimensionalBounds>
      </ContextBridge>
    </ThreeDimensionalCanvas>
  );
}
