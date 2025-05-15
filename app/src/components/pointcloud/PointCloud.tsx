import { memo, ReactNode, useCallback, useMemo, useState } from "react";
import { useContextBridge } from "@react-three/drei";
import { css, ThemeContext as EmotionThemeContext } from "@emotion/react";

import {
  ActionTooltip,
  TooltipTrigger,
  TriggerWrap,
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

import { Button, Heading, Icon, Icons } from "@phoenix/components";
import { UNKNOWN_COLOR } from "@phoenix/constants/pointCloudConstants";
import {
  InferencesContext,
  PointCloudContext,
  ThemeContext,
  usePointCloudContext,
  useTheme,
} from "@phoenix/contexts";
import { useTimeSlice } from "@phoenix/contexts/TimeSliceContext";
import { CanvasMode } from "@phoenix/store";
import { splitEventIdsByInferenceSet } from "@phoenix/utils/pointCloudUtils";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import { CanvasDisplaySettingsDropdown } from "./CanvasDisplaySettingsDropdown";
import { CanvasModeRadioGroup } from "./CanvasModeRadioGroup";
import { PointCloudClusters } from "./PointCloudClusters";
import { PointCloudPointHoverHalo } from "./PointCloudPointHoverHalo";
import { PointCloudPointRelationships } from "./PointCloudPointRelationships";
import { PointCloudPoints } from "./PointCloudPoints";
import { PointCloudPointTooltip } from "./PointCloudPointTooltip";

const RADIUS_BOUNDS_3D_DIVISOR = 300;
const CLUSTER_POINT_RADIUS_MULTIPLIER = 3;
const BOUNDS_3D_ZOOM_PADDING_FACTOR = 0.2;

/**
 * Displays what is loaded in the point cloud
 */
const PointCloudInfo = function PointCloudInfo() {
  const { selectedTimestamp } = useTimeSlice();
  const points = usePointCloudContext((state) => state.points);
  const hdbscanParameters = usePointCloudContext(
    (state) => state.hdbscanParameters
  );
  const umapParameters = usePointCloudContext((state) => state.umapParameters);
  const [numPrimary, numReference, numCorpus] = useMemo(() => {
    const { primaryEventIds, referenceEventIds, corpusEventIds } =
      splitEventIdsByInferenceSet(points.map((point) => point.eventId));
    return [
      primaryEventIds.length,
      referenceEventIds.length,
      corpusEventIds.length,
    ];
  }, [points]);

  if (!selectedTimestamp) {
    return null;
  }
  return (
    <section
      css={css`
        width: 300px;
        padding: var(--ac-global-dimension-static-size-100);
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
        {numCorpus > 0 ? (
          <div>
            <dt>corpus points</dt>
            <dd>{numCorpus}</dd>
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
          <dt>n samples per inferences</dt>
          <dd>{umapParameters.nSamples}</dd>
        </div>
      </dl>
    </section>
  );
};

const descriptionListCSS = css`
  margin: 0;
  padding: 0;
  div {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--ac-global-dimension-static-size-50);
  }
`;

/**
 * Displays the tools available on the point cloud
 * E.g. move vs select
 */
function CanvasTools() {
  const canvasMode = usePointCloudContext((state) => state.canvasMode);
  const setCanvasMode = usePointCloudContext((state) => state.setCanvasMode);
  return (
    <div
      css={css`
        position: absolute;
        left: var(--ac-global-dimension-static-size-100);
        top: var(--ac-global-dimension-static-size-100);
        z-index: 1;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ac-global-dimension-static-size-100);
      `}
    >
      <CanvasModeRadioGroup mode={canvasMode} onChange={setCanvasMode} />
      <CanvasDisplaySettingsDropdown />
      <CanvasInfo />
    </div>
  );
}

/**
 * Displays info about the canvas
 */
function CanvasInfo() {
  return (
    <TooltipTrigger placement="bottom left" delay={0}>
      <TriggerWrap>
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.InfoOutline />} />}
          aria-label="Information bout the point-cloud display"
        />
      </TriggerWrap>
      <ActionTooltip title={"Point Cloud Summary"}>
        <PointCloudInfo />
      </ActionTooltip>
    </TooltipTrigger>
  );
}

function CanvasWrap({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
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
          background: linear-gradient(#f2f6fd 0%, #dbe6fc 74%);
        }
      `}
      data-theme={theme}
    >
      {children}
    </div>
  );
}

export function PointCloud() {
  return (
    <CanvasWrap>
      <CanvasTools key="canvas-tools" />
      <Projection key="projection" />
    </CanvasWrap>
  );
}

const Projection = memo(function Projection() {
  const points = usePointCloudContext((state) => state.points);
  const canvasMode = usePointCloudContext((state) => state.canvasMode);
  const setSelectedEventIds = usePointCloudContext(
    (state) => state.setSelectedEventIds
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
  const { theme } = useTheme();
  const inferencesVisibility = usePointCloudContext(
    (state) => state.inferencesVisibility
  );

  // AutoRotate the canvas on initial load
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  const bounds = useMemo(() => {
    return getThreeDimensionalBounds(points.map((p) => p.position));
  }, [points]);

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
      const group = eventIdToGroup[point.metaData.id] || "unknown";
      return pointGroupColors[group] || UNKNOWN_COLOR;
    },
    [pointGroupColors, eventIdToGroup]
  );

  const primaryData = useMemo(() => {
    return points.filter((point) => {
      return point.eventId.includes("PRIMARY");
    });
  }, [points]);

  const referenceData = useMemo(() => {
    return points.filter((point) => {
      return point.eventId.includes("REFERENCE");
    });
  }, [points]);

  const corpusData = useMemo(() => {
    return points.filter((point) => {
      return point.eventId.includes("CORPUS");
    });
  }, [points]);

  // Filter the points by the group visibility
  const filteredPrimaryData = useMemo(() => {
    return primaryData.filter((point) => {
      const group = eventIdToGroup[point.eventId];
      return pointGroupVisibility[group];
    });
  }, [primaryData, eventIdToGroup, pointGroupVisibility]);

  const filteredReferenceData = useMemo(() => {
    if (!referenceData || referenceData.length === 0) {
      return null;
    }
    return referenceData.filter((point) => {
      const group = eventIdToGroup[point.eventId];
      return pointGroupVisibility[group];
    });
  }, [referenceData, eventIdToGroup, pointGroupVisibility]);

  const filteredCorpusData = useMemo(() => {
    return corpusData.filter((point) => {
      const group = eventIdToGroup[point.eventId];
      return pointGroupVisibility[group];
    });
  }, [corpusData, eventIdToGroup, pointGroupVisibility]);

  // Keep track of all the points in the view, minus the ones filtered out by visibility controls
  const allVisiblePoints = useMemo(() => {
    const visiblePrimaryPoints = inferencesVisibility.primary
      ? filteredPrimaryData
      : [];
    const visibleReferencePoints = inferencesVisibility.reference
      ? filteredReferenceData
      : [];
    const visibleCorpusPoints = inferencesVisibility.corpus
      ? filteredCorpusData
      : [];
    const visiblePoints = [
      ...visiblePrimaryPoints,
      ...(visibleReferencePoints || []),
      ...(visibleCorpusPoints || []),
    ];
    return visiblePoints;
  }, [
    filteredPrimaryData,
    filteredReferenceData,
    filteredCorpusData,
    inferencesVisibility,
  ]);

  // Context cannot be passed through multiple reconcilers. Bridge the context
  const ContextBridge = useContextBridge(
    PointCloudContext,
    InferencesContext,
    EmotionThemeContext,
    ThemeContext
  );

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
              setSelectedEventIds(new Set(selection.map((s) => s.metaData.id)));
              setSelectedClusterId(null);
            }}
            enabled={canvasMode === CanvasMode.select}
          />
          <Axes
            size={(bounds.maxX - bounds.minX) / 4}
            color={theme == "dark" ? "#fff" : "#505050"}
          />
          <PointCloudPoints
            primaryData={filteredPrimaryData}
            referenceData={filteredReferenceData}
            corpusData={filteredCorpusData}
            color={colorFn}
            radius={radius}
          />
          <PointCloudClusters radius={clusterPointRadius} />
          <PointCloudPointTooltip />
          <PointCloudPointHoverHalo pointRadius={radius} />
          <PointCloudPointRelationships />
        </ThreeDimensionalBounds>
      </ContextBridge>
    </ThreeDimensionalCanvas>
  );
});
