import { fetchQuery, graphql } from "react-relay";
import { interpolateCool, schemeCategory10 } from "d3-scale-chromatic";
import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";

import { ColorSchemes } from "@arizeai/point-cloud";

import {
  ColoringStrategy,
  CorrectnessGroup,
  DatasetGroup,
  DEFAULT_CLUSTER_MIN_SAMPLES,
  DEFAULT_CLUSTER_SELECTION_EPSILON,
  DEFAULT_DARK_COLOR_SCHEME,
  DEFAULT_DATASET_SAMPLE_SIZE,
  DEFAULT_LIGHT_COLOR_SCHEME,
  DEFAULT_MIN_CLUSTER_SIZE,
  DEFAULT_MIN_DIST,
  DEFAULT_N_NEIGHBORS,
  FALLBACK_COLOR,
  SelectionDisplay,
  SelectionGridSize,
  UNKNOWN_COLOR,
} from "@phoenix/constants/pointCloudConstants";
import { getCurrentTheme } from "@phoenix/contexts";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import { Dimension } from "@phoenix/types";
import { assertUnreachable } from "@phoenix/typeUtils";
import { splitEventIdsByDataset } from "@phoenix/utils/pointCloudUtils";

import { pointCloudStore_clusterMetricsQuery } from "./__generated__/pointCloudStore_clusterMetricsQuery.graphql";
import { pointCloudStore_clustersQuery } from "./__generated__/pointCloudStore_clustersQuery.graphql";
import { pointCloudStore_dimensionMetadataQuery } from "./__generated__/pointCloudStore_dimensionMetadataQuery.graphql";
import {
  pointCloudStore_eventsQuery,
  pointCloudStore_eventsQuery$data,
} from "./__generated__/pointCloudStore_eventsQuery.graphql";

/**
 * THe number of numeric groups to use when coloring by a numeric dimension.
 */
const NUM_NUMERIC_GROUPS = 10;

/**
 * The group that an unknown point belongs to
 * E.x. if the point is missing a prediction label
 */
const UNKNOWN_GROUP = "unknown";

// Color scales for dynamic coloring.
const sequentialColorScale = interpolateCool;
const discreteColorScaleCategories = schemeCategory10;
const discreteColorScale = (value: number) =>
  discreteColorScaleCategories[value];
const numericColorScale = (idx: number) =>
  sequentialColorScale(idx / NUM_NUMERIC_GROUPS);

type EventId = string;

type DimensionMetadata = {
  /**
   * The min and max values of a numeric  dimension
   */
  readonly interval: Interval | null;
  /**
   * The unique values of a categorical dimension
   */
  readonly categories: readonly string[] | null;
};

export type UMAPParameters = {
  /**
   * Minimum distance between points in the eUMAP projection
   */
  minDist: number;
  /**
   * The number of neighbors to require for the UMAP projection
   */
  nNeighbors: number;
  /**
   * The number of samples to use for the UMAP projection. The sample number is per dataset.
   */
  nSamples: number;
};

export type CanvasTheme = "light" | "dark";

/**
 * The tool mode of the canvas
 */
export enum CanvasMode {
  move = "move",
  select = "select",
}

export enum ClusterColorMode {
  default = "default",
  /**
   * Highlights the different clusters all at once
   */
  highlight = "highlight",
}

/**
 * The visibility of the two datasets in the point cloud.
 */
type DatasetVisibility = {
  primary: boolean;
  reference: boolean;
  corpus: boolean;
};

export interface Point {
  readonly id: string;
  /**
   * The id of event the point is associated to
   */
  readonly eventId: EventId;
  readonly position: ThreeDimensionalPosition;
  /**
   * Metadata about the point - used for point-cloud selection
   */
  readonly metaData: {
    readonly id: EventId;
  };
  readonly eventMetadata: {
    readonly predictionId: string | null;
    readonly predictionScore: number | null;
    readonly predictionLabel: string | null;
    readonly actualScore: number | null;
    readonly actualLabel: string | null;
  };
  readonly embeddingMetadata: {
    linkToData: string | null;
    rawData: string | null;
  };
  retrievals?: Retrieval[];
}

/**
 * Abstract definition of a retrieval from a Retrieval embedding
 */
export interface Retrieval {
  readonly documentId: string;
  readonly queryId: string;
  readonly relevance: number | null;
}

/**
 * Values of the cluster that are computed
 */
interface ClusterComputedFields {
  readonly size: number;
  /**
   * The two metric values for the cluster
   */
  readonly primaryMetricValue: number | null;
  readonly referenceMetricValue: number | null;
}

interface ClusterBase {
  readonly driftRatio: number | null;
  /**
   * The ratio of the primary dataset to the corpus
   * Used for troubleshooting retrieval of data from a corpus dataset
   */
  readonly primaryToCorpusRatio: number | null;
  readonly eventIds: readonly string[];
  readonly id: string;
  /** data quality metric from graphql */
  dataQualityMetric?: {
    readonly primaryValue: number | null;
    readonly referenceValue: number | null;
  };
  /** performance metric from graphql */
  performanceMetric?: {
    readonly primaryValue: number | null;
    readonly referenceValue: number | null;
  };
}
interface Cluster extends ClusterComputedFields, ClusterBase {}

/**
 * The subset of the cluster that is passed in
 * The omitted fields are computed
 */
type ClusterInput = ClusterBase;

/**
 * The sort order of the clusters
 */
export type ClusterSort = {
  dir: "asc" | "desc";
  column: keyof Cluster;
};

export type EventData =
  pointCloudStore_eventsQuery$data["model"]["primaryDataset"]["events"][number];

/**
 * A mapping from a point ID to its data
 */
type PointDataMap = Record<string, EventData | undefined>;

/**
 * The clustering parameters for HDBSCAN
 */
type HDBSCANParameters = {
  /**
   * The minimum cluster size
   * @default 10
   */
  minClusterSize: number;
  /**
   * The minimum number of samples in a cluster
   * @default 1
   */
  clusterMinSamples: number;
  /**
   * The cluster selection epsilon
   * @default 0
   */
  clusterSelectionEpsilon: number;
};

export type RetrievalMetricDefinition = {
  type: "retrieval";
  metric: "queryDistance";
};
export type DriftMetricDefinition = {
  type: "drift";
  metric: "euclideanDistance";
};

export type PerformanceMetricDefinition = {
  type: "performance";
  metric: "accuracyScore";
};

export type DataQualityMetricDefinition = {
  type: "dataQuality";
  metric: "average";
  dimension: {
    id: string;
    name: string;
  };
};

export type MetricDefinition =
  | DriftMetricDefinition
  | PerformanceMetricDefinition
  | DataQualityMetricDefinition
  | RetrievalMetricDefinition;

/**
 * The properties of the point cloud store.
 */
export interface PointCloudProps {
  /**
   * Whether or not the point cloud is loading
   * @default false
   */
  loading: boolean;
  /**
   * The point information that is currently loaded into view
   */
  points: readonly Point[];

  /**
   * A mapping of the event ID to the corresponding point data
   */
  eventIdToDataMap: Map<string, Point>;
  /**
   * The clusters of points
   */
  clusters: readonly Cluster[];
  /**
   * The sort order of the clusters
   * @default { dir: "desc", column: "driftRatio" }
   */
  clusterSort: ClusterSort;
  /**
   * The point information that is currently loaded into view
   * If it is null, the point data is being loaded.
   */
  pointData: PointDataMap | null;
  /**
   * The IDs of the points that are currently selected.
   */
  selectedEventIds: Set<string>;
  /**
   * The ID of the event that is currently hovered over.
   */
  hoveredEventId: string | null;
  /**
   * The ID of the cluster that are currently highlighted.
   */
  highlightedClusterId: string | null;
  /**
   * The ID of the cluster that is currently selected.
   */
  selectedClusterId: string | null;
  /**
   * The canvas mode of the point cloud.
   * @default "move"
   */
  canvasMode: CanvasMode;
  /**
   * The point size scale
   * @default 1
   */
  pointSizeScale: number;
  /**
   * the cluster color mode
   * @default "default"
   */
  clusterColorMode: ClusterColorMode;
  /**
   * The coloring strategy to use for the point cloud.
   */
  coloringStrategy: ColoringStrategy;
  /**
   * The visibility of the two datasets in the point cloud.
   * @default { primary: true, reference: true }
   */
  datasetVisibility: DatasetVisibility;
  /**
   * The visibility of the point groups in the point cloud.
   */
  pointGroupVisibility: Record<string, boolean>;
  /**
   * The colors of each point group in the point cloud.
   */
  pointGroupColors: Record<string, string>;
  /**
   * The mapping from eventId to point group.
   */
  eventIdToGroup: Record<string, string>;
  /**
   * The way in which the selected points are displayed in the selection panel
   * E.g. as a gallery or a list
   */
  selectionDisplay: SelectionDisplay;
  /**
   * The grid size of the selections when displayed as a grid
   * @default "large"
   */
  selectionGridSize: SelectionGridSize;
  /**
   * When the coloring strategy is set to `dimension`, this property is set lazily by the user
   */
  dimension: Dimension | null;
  /**
   * Dimension level metadata for the current selected dimension
   */
  dimensionMetadata: DimensionMetadata | null;
  /**
   * UMAP Parameters
   */
  umapParameters: UMAPParameters;
  /**
   * The clustering / HDBSCAN parameters
   */
  hdbscanParameters: HDBSCANParameters;
  /**
   * An error message if anything occurs during point-cloud data loads
   */
  errorMessage: string | null;
  /**
   * Whether or not the clusters are loading or not
   */
  clustersLoading: boolean;
  /**
   * The overall metric for the point cloud
   */
  metric: MetricDefinition;
}

export interface PointCloudState extends PointCloudProps {
  /**
   * Sets the data displayed within the point cloud
   */
  setInitialData: (data: {
    points: readonly Point[];
    clusters: readonly ClusterInput[];
    retrievals: readonly Retrieval[];
  }) => void;
  /**
   * Sets the clusters to be displayed within the point cloud
   */
  setClusters: (clusters: readonly ClusterInput[]) => void;
  /**
   * Set the cluster sort order
   */
  setClusterSort: (sort: ClusterSort) => void;
  /**
   * Sets the selected eventIds to the given value.
   */
  setSelectedEventIds: (ids: Set<string>) => void;
  /**
   * Set the hovered event id
   * @param {string | null} id
   */
  setHoveredEventId: (id: string | null) => void;
  /**
   * Sets the selected cluster id to the given value.
   */
  setHighlightedClusterId: (ids: string | null) => void;
  /**
   * Sets the selected cluster id to the given value.
   */
  setSelectedClusterId: (ids: string | null) => void;
  /**
   * set the canvas mode
   */
  setCanvasMode: (mode: CanvasMode) => void;
  /**
   * Set the point size scale
   * @param {number} scale
   */
  setPointSizeScale: (scale: number) => void;
  /**
   * set the cluster color mode
   */
  setClusterColorMode: (mode: ClusterColorMode) => void;
  /**
   * Sets the coloring strategy to the given value.
   */
  setColoringStrategy: (strategy: ColoringStrategy) => void;
  /**
   * Sets the dataset visibility to the given value.
   * @param {DatasetVisibility} visibility
   */
  setDatasetVisibility: (visibility: DatasetVisibility) => void;
  /**
   * Sets the point group visibility for the entire point cloud
   * @param {Record<string, PointGroupVisibility>} visibility
   */
  setPointGroupVisibility: (visibility: Record<string, boolean>) => void;
  /**
   * Set the selection display of the selection panel
   */
  setSelectionDisplay: (display: SelectionDisplay) => void;
  /**
   * Set the grid size of the selections when displayed as a grid
   */
  setSelectionGridSize: (size: SelectionGridSize) => void;
  /**
   * Set the dimension to use for coloring the point cloud
   */
  setDimension: (dimension: Dimension) => void;
  /**
   * Set the dimension metadata for the current selected dimension
   */
  setDimensionMetadata: (dimensionMetadata: DimensionMetadata) => void;
  /**
   * Set the UMAP parameters
   */
  setUMAPParameters: (parameters: UMAPParameters) => void;
  /**
   * Set the HDBSCAN parameters
   */
  setHDBSCANParameters: (parameters: HDBSCANParameters) => void;
  /**
   * This is a getter for the hdbscan parameters
   * NB: this is so that useEffect doesn't trigger when the parameters are set
   */
  getHDSCANParameters: () => HDBSCANParameters;
  /**
   * Retrieves the metric parameters for the point cloud
   * Note that this is a getter so that useEffect doesn't trigger when the parameters are set
   */
  getMetric: () => MetricDefinition;
  /**
   * Clear the selections in the point cloud
   * Done when the point cloud is re-loaded
   */
  reset: () => void;
  /**
   * Set the error message
   */
  setErrorMessage: (message: string | null) => void;
  /**
   * Set the loading state
   */
  setLoading: (loading: boolean) => void;
  /**
   * Set the overall metric used in the point-cloud
   */
  setMetric(metric: MetricDefinition): void;
}

const DEFAULT_COLOR_SCHEME =
  getCurrentTheme() === "light"
    ? DEFAULT_LIGHT_COLOR_SCHEME
    : DEFAULT_DARK_COLOR_SCHEME;

/**
 * The default point cloud properties in the case that there are two datasets.
 */
export const DEFAULT_DRIFT_POINT_CLOUD_PROPS: Partial<PointCloudProps> = {
  coloringStrategy: ColoringStrategy.dataset,
  pointGroupVisibility: {
    [DatasetGroup.primary]: true,
    [DatasetGroup.reference]: true,
  },
  pointGroupColors: {
    [DatasetGroup.primary]: DEFAULT_COLOR_SCHEME[0],
    [DatasetGroup.reference]: DEFAULT_COLOR_SCHEME[1],
    [DatasetGroup.corpus]: FALLBACK_COLOR,
  },
  metric: {
    type: "drift",
    metric: "euclideanDistance",
  },
};

/**
 * The default point cloud properties in the case that there are two datasets.
 */
export const DEFAULT_RETRIEVAL_TROUBLESHOOTING_POINT_CLOUD_PROPS: Partial<PointCloudProps> =
  {
    coloringStrategy: ColoringStrategy.dataset,
    pointGroupVisibility: {
      [DatasetGroup.primary]: true,
      [DatasetGroup.corpus]: true,
    },
    pointGroupColors: {
      [DatasetGroup.primary]: DEFAULT_COLOR_SCHEME[0],
      [DatasetGroup.corpus]: FALLBACK_COLOR,
    },
    metric: {
      type: "retrieval",
      metric: "queryDistance",
    },
    // Since we are showing clusters by percent query, sort from highest query density to lowest
    clusterSort: { dir: "desc", column: "primaryMetricValue" },
  };

/**
 * The default point cloud properties in the case that there is only one dataset.
 */
export const DEFAULT_SINGLE_DATASET_POINT_CLOUD_PROPS: Partial<PointCloudProps> =
  {
    coloringStrategy: ColoringStrategy.correctness,
    pointGroupVisibility: {
      [CorrectnessGroup.correct]: true,
      [CorrectnessGroup.incorrect]: true,
      [CorrectnessGroup.unknown]: true,
    },
    pointGroupColors: {
      [CorrectnessGroup.correct]: ColorSchemes.Discrete2.LightBlueOrange[0],
      [CorrectnessGroup.incorrect]: ColorSchemes.Discrete2.LightBlueOrange[1],
      [CorrectnessGroup.unknown]: UNKNOWN_COLOR,
    },
    metric: {
      type: "performance",
      metric: "accuracyScore",
    },
    // Since we are showing clusters by accuracy, sort from lowest accuracy to highest
    clusterSort: { dir: "asc", column: "primaryMetricValue" },
  };

export type PointCloudStore = ReturnType<typeof createPointCloudStore>;

export const createPointCloudStore = (initProps?: Partial<PointCloudProps>) => {
  // The default props irrespective of the number of datasets
  const defaultProps: PointCloudProps = {
    loading: false,
    errorMessage: null,
    points: [],
    eventIdToDataMap: new Map(),
    clusters: [],
    clusterSort: { dir: "desc", column: "driftRatio" },
    pointData: null,
    selectedEventIds: new Set(),
    hoveredEventId: null,
    highlightedClusterId: null,
    selectedClusterId: null,
    canvasMode: CanvasMode.move,
    pointSizeScale: 1,
    clusterColorMode: ClusterColorMode.default,
    coloringStrategy: ColoringStrategy.dataset,
    datasetVisibility: { primary: true, reference: true, corpus: true },
    pointGroupVisibility: {
      [DatasetGroup.primary]: true,
      [DatasetGroup.reference]: true,
      [DatasetGroup.corpus]: true,
    },
    pointGroupColors: {
      // TODO move to a single source of truth
      [DatasetGroup.primary]: DEFAULT_COLOR_SCHEME[0],
      [DatasetGroup.reference]: DEFAULT_COLOR_SCHEME[1],
      [DatasetGroup.corpus]: FALLBACK_COLOR,
    },
    eventIdToGroup: {},
    selectionDisplay: SelectionDisplay.gallery,
    selectionGridSize: SelectionGridSize.large,
    dimension: null,
    dimensionMetadata: null,
    umapParameters: {
      minDist: DEFAULT_MIN_DIST,
      nNeighbors: DEFAULT_N_NEIGHBORS,
      nSamples: DEFAULT_DATASET_SAMPLE_SIZE,
    },
    hdbscanParameters: {
      minClusterSize: DEFAULT_MIN_CLUSTER_SIZE,
      clusterMinSamples: DEFAULT_CLUSTER_MIN_SAMPLES,
      clusterSelectionEpsilon: DEFAULT_CLUSTER_SELECTION_EPSILON,
    },
    clustersLoading: false,
    metric: {
      type: "drift",
      metric: "euclideanDistance",
    },
  };

  const pointCloudStore: StateCreator<PointCloudState> = (set, get) => ({
    ...defaultProps,
    ...initProps,
    setInitialData: async ({ points, clusters, retrievals }) => {
      const pointCloud = get();
      const eventIdToDataMap = new Map<string, Point>();

      // make a dictionary of eventIds to their retrievals
      const eventIdToRetrievals: Record<string, Retrieval[]> =
        retrievals.reduce((acc, retrieval) => {
          const { queryId } = retrieval;
          if (acc[queryId]) {
            acc[queryId].push(retrieval);
          } else {
            acc[queryId] = [retrieval];
          }
          return acc;
        }, {} as Record<string, Retrieval[]>);

      // Calculate a map of event ID to point data
      points.forEach((p) => {
        p = {
          ...p,
          retrievals: eventIdToRetrievals[p.eventId] ?? [],
        };
        eventIdToDataMap.set(p.eventId, p);
      });

      const sortedClusters = clusters
        .map(normalizeCluster)
        .sort(clusterSortFn(pointCloud.clusterSort));

      set({
        loading: false,
        points: points,
        eventIdToDataMap,
        clusters: sortedClusters,
        clustersLoading: false,
        selectedEventIds: new Set(),
        selectedClusterId: null,
        pointData: null,
        eventIdToGroup: getEventIdToGroup({
          points,
          coloringStrategy: pointCloud.coloringStrategy,
          pointsData: pointCloud.pointData ?? {},
          dimension: pointCloud.dimension || null,
          dimensionMetadata: pointCloud.dimensionMetadata,
        }),
      });
      // Re-compute the point coloring once the granular data is loaded
      const pointData = await fetchPointEvents(
        points.map((p) => p.eventId)
      ).catch(() => set({ errorMessage: "Failed to load the point events" }));

      if (!pointData) return; // The error occurred above

      set({
        pointData,
        // TODO(mikeldking): For some reason the point-cloud doesn't rerender clusters unless this exists
        clusters: sortedClusters,
        clustersLoading: false,
        eventIdToGroup: getEventIdToGroup({
          points,
          coloringStrategy: pointCloud.coloringStrategy,
          pointsData: pointData ?? {},
          dimension: pointCloud.dimension || null,
          dimensionMetadata: pointCloud.dimensionMetadata,
        }),
      });
    },
    setClusters: (clusters) => {
      const pointCloud = get();
      const sortedClusters = clusters
        .map(normalizeCluster)
        .sort(clusterSortFn(pointCloud.clusterSort));
      set({
        clusters: sortedClusters,
        clustersLoading: false,
        selectedClusterId: null,
        highlightedClusterId: null,
      });
    },
    setClusterSort: (sort) => {
      const pointCloud = get();
      const sortedClusters = [...pointCloud.clusters].sort(clusterSortFn(sort));
      set({ clusterSort: sort, clusters: sortedClusters });
    },
    setSelectedEventIds: (ids) => set({ selectedEventIds: ids }),
    setHoveredEventId: (id) => set({ hoveredEventId: id }),
    setHighlightedClusterId: (id) => set({ highlightedClusterId: id }),
    setSelectedClusterId: (id) =>
      set({ selectedClusterId: id, highlightedClusterId: null }),
    setPointSizeScale: (scale) => set({ pointSizeScale: scale }),
    setCanvasMode: (mode) => set({ canvasMode: mode }),
    setClusterColorMode: (mode) => set({ clusterColorMode: mode }),
    setColoringStrategy: (strategy) => {
      const pointCloudState = get();
      set({ coloringStrategy: strategy });
      switch (strategy) {
        case ColoringStrategy.correctness:
          set({
            pointGroupVisibility: {
              [CorrectnessGroup.correct]: true,
              [CorrectnessGroup.incorrect]: true,
              [CorrectnessGroup.unknown]: true,
            },
            pointGroupColors: {
              [CorrectnessGroup.correct]:
                ColorSchemes.Discrete2.LightBlueOrange[0],
              [CorrectnessGroup.incorrect]:
                ColorSchemes.Discrete2.LightBlueOrange[1],
              [CorrectnessGroup.unknown]: UNKNOWN_COLOR,
            },
            dimension: null,
            dimensionMetadata: null,
            eventIdToGroup: getEventIdToGroup({
              points: pointCloudState.points,
              coloringStrategy: strategy,
              pointsData: pointCloudState.pointData ?? {},
              dimension: pointCloudState.dimension || null,
              dimensionMetadata: pointCloudState.dimensionMetadata,
            }),
          });
          break;
        case ColoringStrategy.dataset: {
          // Clear out the point groups as there are no groups
          set({
            pointGroupVisibility: {
              [DatasetGroup.primary]: true,
              [DatasetGroup.reference]: true,
              [DatasetGroup.corpus]: true,
            },
            pointGroupColors: {
              // TODO move these colors to a constants file
              [DatasetGroup.primary]: DEFAULT_COLOR_SCHEME[0],
              [DatasetGroup.reference]: DEFAULT_COLOR_SCHEME[1],
              [DatasetGroup.corpus]: FALLBACK_COLOR,
            },
            dimension: null,
            dimensionMetadata: null,
            eventIdToGroup: getEventIdToGroup({
              points: pointCloudState.points,
              coloringStrategy: strategy,
              pointsData: pointCloudState.pointData ?? {},
              dimension: pointCloudState.dimension || null,
              dimensionMetadata: pointCloudState.dimensionMetadata,
            }),
          });
          break;
        }
        case ColoringStrategy.dimension: {
          // come dynamically from the dimension "values"
          set({
            pointGroupVisibility: {
              unknown: true,
            },
            pointGroupColors: {
              unknown: UNKNOWN_COLOR,
            },
            dimension: null,
            dimensionMetadata: null,
            eventIdToGroup: getEventIdToGroup({
              points: pointCloudState.points,
              coloringStrategy: strategy,
              pointsData: pointCloudState.pointData ?? {},
              dimension: pointCloudState.dimension || null,
              dimensionMetadata: pointCloudState.dimensionMetadata,
            }),
          });
          break;
        }
        default:
          assertUnreachable(strategy);
      }
    },
    datasetVisibility: { primary: true, reference: true, corpus: true },
    setDatasetVisibility: (visibility) =>
      set({ datasetVisibility: visibility }),
    setPointGroupVisibility: (visibility) =>
      set({ pointGroupVisibility: visibility }),
    selectionDisplay: SelectionDisplay.gallery,
    setSelectionDisplay: (display) => set({ selectionDisplay: display }),
    setSelectionGridSize: (size) => set({ selectionGridSize: size }),
    reset: () => {
      set({
        points: [],
        clusters: [],
        selectedEventIds: new Set(),
        selectedClusterId: null,
        eventIdToGroup: {},
      });
    },
    setDimension: async (dimension) => {
      const pointCloudState = get();
      set({ dimension, dimensionMetadata: null });
      const dimensionMetadata = await fetchDimensionMetadata(dimension).catch(
        () => set({ errorMessage: "Failed to load the dimension metadata" })
      );
      if (!dimensionMetadata) return; // The error occurred above

      set({ dimensionMetadata });
      if (dimensionMetadata.categories && dimensionMetadata.categories.length) {
        const numCategories = dimensionMetadata.categories.length;
        // If the number of categories is less than the discrete color scale, use discrete color scheme
        const useDiscreteColorScale =
          numCategories <= discreteColorScaleCategories.length;
        const colorScaleFn = useDiscreteColorScale
          ? discreteColorScale
          : (index: number) => sequentialColorScale(index / numCategories);
        set({
          pointGroupVisibility: {
            ...dimensionMetadata.categories.reduce(
              (acc, category) => ({
                ...acc,
                [category]: true,
              }),
              {}
            ),
            unknown: true,
          },
          pointGroupColors: {
            ...dimensionMetadata.categories.reduce(
              (acc, category, idx) => ({
                ...acc,
                [category]: colorScaleFn(idx),
              }),
              {}
            ),
            unknown: UNKNOWN_COLOR,
          },
          eventIdToGroup: getEventIdToGroup({
            points: pointCloudState.points,
            coloringStrategy: pointCloudState.coloringStrategy,
            pointsData: pointCloudState.pointData ?? {},
            dimension,
            dimensionMetadata,
          }),
        });
      } else if (dimensionMetadata.interval !== null) {
        // Create color groups based on the min / max of the dimension
        const groups = getNumericGroupsFromInterval(dimensionMetadata.interval);

        set({
          pointGroupVisibility: {
            ...groups.reduce(
              (acc, group) => ({
                ...acc,
                [group.name]: true,
              }),
              {}
            ),
            unknown: true,
          },
          pointGroupColors: {
            ...groups.reduce(
              (acc, group, idx) => ({
                ...acc,
                [group.name]: numericColorScale(idx),
              }),
              {}
            ),
            unknown: UNKNOWN_COLOR,
          },
          eventIdToGroup: getEventIdToGroup({
            points: pointCloudState.points,
            coloringStrategy: pointCloudState.coloringStrategy,
            pointsData: pointCloudState.pointData ?? {},
            dimension,
            dimensionMetadata,
          }),
        });
      }
    },
    setDimensionMetadata: (dimensionMetadata) => set({ dimensionMetadata }),
    setUMAPParameters: (umapParameters) => set({ umapParameters }),
    setHDBSCANParameters: async (hdbscanParameters) => {
      const pointCloud = get();
      set({ hdbscanParameters, clustersLoading: true });
      const clusters = await fetchClusters({
        metric: pointCloud.metric,
        points: pointCloud.points,
        hdbscanParameters,
      });
      pointCloud.setClusters(clusters);
    },
    getHDSCANParameters: () => get().hdbscanParameters,
    getMetric: () => get().metric,
    setErrorMessage: (errorMessage) => set({ errorMessage }),
    setLoading: (loading: boolean) => set({ loading }),
    setMetric: async (metric) => {
      const pointCloud = get();
      set({ metric, clustersLoading: true });
      // Re-calculates the cluster's metrics
      const clusters = await fetchClusterMetrics({
        metric,
        clusters: pointCloud.clusters,
        hdbscanParameters: pointCloud.hdbscanParameters,
      });
      pointCloud.setClusters(clusters);
    },
  });

  return create<PointCloudState>()(devtools(pointCloudStore));
};

// ---- Helper functions ----
/**
 * A numeric number Interval. Includes the min, excludes the max.
 * E.g. [min, max)
 */
interface Interval {
  min: number;
  max: number;
}

/**
 * An interval that represents a group of numeric values
 */
interface NumericGroupInterval extends Interval {
  name: string;
}

const numberFormatter = new Intl.NumberFormat([], {
  maximumFractionDigits: 2,
});
/**
 * A human readable string representation of an interval
 */
function intervalToString({ min, max }: Interval): string {
  return `${numberFormatter.format(min)} - ${numberFormatter.format(max)}`;
}

/**
 * Calculates the groups for numeric dimensions and splits it into interval groups
 * E.x. [0, 10] => [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10]
 */
function getNumericGroupsFromInterval({
  min,
  max,
}: Interval): NumericGroupInterval[] {
  const range = max - min;
  // Break the range into 10 groups
  const groupSliceSize = range / NUM_NUMERIC_GROUPS;
  const groups: NumericGroupInterval[] = [];
  for (let i = 0; i < NUM_NUMERIC_GROUPS; i++) {
    const groupMin = min + i * groupSliceSize;
    const groupMax = min + (i + 1) * groupSliceSize;
    groups.push({
      min: groupMin,
      max: groupMax,
      name: intervalToString({ min: groupMin, max: groupMax }),
    });
  }
  return groups;
}

function getEventGroupForNumericValue({
  numericGroupIntervals,
  numericValue,
}: {
  numericGroupIntervals: NumericGroupInterval[];
  numericValue: number;
}): string {
  let eventGroup = UNKNOWN_GROUP;
  let groupIndex = numericGroupIntervals.findIndex(
    (group) => numericValue >= group.min && numericValue < group.max
  );
  // If we fail to find the index, it means it belongs to the last group
  groupIndex = groupIndex === -1 ? NUM_NUMERIC_GROUPS - 1 : groupIndex;
  eventGroup = numericGroupIntervals[groupIndex].name;

  return eventGroup;
}
/**
 * Calculates the group mapping for each point
 */
function getEventIdToGroup(
  params: GetEventIdToGroupParams
): Record<string, string> {
  const { points, coloringStrategy, pointsData, dimension, dimensionMetadata } =
    params;
  const eventIdToGroup: Record<string, string> = {};
  const eventIds = points.map((point) => point.eventId);
  switch (coloringStrategy) {
    case ColoringStrategy.dataset: {
      const { primaryEventIds, referenceEventIds, corpusEventIds } =
        splitEventIdsByDataset(eventIds);
      primaryEventIds.forEach((eventId) => {
        eventIdToGroup[eventId] = DatasetGroup.primary;
      });
      referenceEventIds.forEach((eventId) => {
        eventIdToGroup[eventId] = DatasetGroup.reference;
      });
      corpusEventIds.forEach((eventId) => {
        eventIdToGroup[eventId] = DatasetGroup.corpus;
      });
      break;
    }
    case ColoringStrategy.correctness: {
      points.forEach((point) => {
        let group = CorrectnessGroup.unknown;

        const { predictionLabel, actualLabel } = point.eventMetadata;
        if (predictionLabel !== null && actualLabel !== null) {
          group =
            predictionLabel === actualLabel
              ? CorrectnessGroup.correct
              : CorrectnessGroup.incorrect;
        }
        eventIdToGroup[point.eventId] = group;
      });
      break;
    }
    case ColoringStrategy.dimension: {
      let numericGroupIntervals: NumericGroupInterval[] | null;
      if (dimensionMetadata && dimensionMetadata?.interval !== null) {
        numericGroupIntervals = getNumericGroupsFromInterval(
          dimensionMetadata.interval
        );
      }
      const isColorByPredictionLabel =
        dimension?.type === "prediction" &&
        dimension?.dataType === "categorical";
      const isColorByPredictionScore =
        dimension?.type === "prediction" && dimension?.dataType === "numeric";
      const isColorByActualLabel =
        dimension?.type === "actual" && dimension?.dataType === "categorical";
      const isColorByActualScore =
        dimension?.type === "actual" && dimension?.dataType === "numeric";

      points.forEach((point) => {
        let group = UNKNOWN_GROUP;
        const pointData = pointsData[point.eventId];

        // Flag to determine if we have enough data to color by dimension
        const haveSufficientDataToColorByDimension =
          dimension != null && pointData != null;

        if (haveSufficientDataToColorByDimension) {
          if (isColorByPredictionLabel) {
            group = pointData.eventMetadata.predictionLabel ?? UNKNOWN_GROUP;
          } else if (isColorByPredictionScore) {
            if (numericGroupIntervals == null) {
              throw new Error(
                "Cannot color by prediction score without numeric group intervals"
              );
            }
            const numericValue = pointData.eventMetadata.predictionScore;
            if (typeof numericValue === "number") {
              group = getEventGroupForNumericValue({
                numericGroupIntervals,
                numericValue,
              });
            }
          } else if (isColorByActualScore) {
            if (numericGroupIntervals == null) {
              throw new Error(
                "Cannot color by actual score without numeric group intervals"
              );
            }
            const numericValue = pointData.eventMetadata.actualScore;
            if (typeof numericValue === "number") {
              group = getEventGroupForNumericValue({
                numericGroupIntervals,
                numericValue,
              });
            }
          } else if (isColorByActualLabel) {
            group = pointData.eventMetadata.actualLabel ?? UNKNOWN_GROUP;
          } else {
            // It is a feature or tag. Find the dimension value
            const dimensionWithValue = pointData.dimensions.find(
              (dimensionWithValue) =>
                dimensionWithValue.dimension.name === dimension.name
            );
            if (
              dimensionWithValue != null &&
              dimension.dataType === "categorical"
            ) {
              // The group is just the categorical value. If it is null, we use "unknown" for now
              group = dimensionWithValue.value ?? UNKNOWN_GROUP;
            } else if (
              dimensionWithValue != null &&
              dimension.dataType === "numeric" &&
              numericGroupIntervals != null
            ) {
              const numericValue =
                typeof dimensionWithValue?.value === "string"
                  ? parseFloat(dimensionWithValue.value)
                  : null;
              if (typeof numericValue === "number") {
                group = getEventGroupForNumericValue({
                  numericGroupIntervals,
                  numericValue,
                });
              }
            }
          }
        }

        eventIdToGroup[point.eventId] = group;
      });

      break;
    }
    default:
      assertUnreachable(coloringStrategy);
  }
  return eventIdToGroup;
}

// ---- Async data retrieval functions ---

/**
 * Fetches the dimension metadata for coloring group computation
 */
async function fetchDimensionMetadata(
  dimension: Dimension
): Promise<DimensionMetadata> {
  const data = await fetchQuery<pointCloudStore_dimensionMetadataQuery>(
    RelayEnvironment,
    graphql`
      query pointCloudStore_dimensionMetadataQuery(
        $id: GlobalID!
        $getDimensionMinMax: Boolean!
        $getDimensionCategories: Boolean!
      ) {
        dimension: node(id: $id) @required(action: THROW) {
          ... on Dimension {
            id
            min: dataQualityMetric(metric: min)
              @include(if: $getDimensionMinMax)
            max: dataQualityMetric(metric: max)
              @include(if: $getDimensionMinMax)
            categories @include(if: $getDimensionCategories)
          }
        }
      }
    `,
    {
      id: dimension.id,
      getDimensionMinMax: dimension.dataType === "numeric",
      getDimensionCategories: dimension.dataType === "categorical",
    }
  ).toPromise();

  const dimensionData = data?.dimension;

  if (!dimension) {
    throw new Error("Dimension not found");
  }

  let interval: Interval | null = null;
  if (
    typeof dimensionData?.min === "number" &&
    typeof dimensionData?.max === "number"
  ) {
    interval = { min: dimensionData.min, max: dimensionData.max };
  }
  return {
    interval,
    categories: dimensionData?.categories ?? null,
  };
}

type GetEventIdToGroupParams = {
  points: readonly Point[];
  coloringStrategy: ColoringStrategy;
  pointsData: PointDataMap;
  /**
   * If coloring by dimension, the dimension to use for coloring
   */
  dimension?: Dimension | null;
  /**
   * If coloring by dimension, the dimension metadata to use for coloring
   */
  dimensionMetadata?: DimensionMetadata | null;
};

async function fetchPointEvents(eventIds: string[]): Promise<PointDataMap> {
  const { primaryEventIds, referenceEventIds, corpusEventIds } =
    splitEventIdsByDataset([...eventIds]);
  const data = await fetchQuery<pointCloudStore_eventsQuery>(
    RelayEnvironment,
    graphql`
      query pointCloudStore_eventsQuery(
        $primaryEventIds: [ID!]!
        $referenceEventIds: [ID!]!
        $corpusEventIds: [ID!]!
      ) {
        model {
          primaryDataset {
            events(eventIds: $primaryEventIds) {
              id
              dimensions {
                dimension {
                  name
                  type
                }
                value
              }
              eventMetadata {
                predictionId
                predictionLabel
                predictionScore
                actualLabel
                actualScore
              }
              promptAndResponse {
                prompt
                response
              }
              # TODO: delineate between corpus events and dataset events
              documentText
            }
          }
          referenceDataset {
            events(eventIds: $referenceEventIds) {
              id
              dimensions {
                dimension {
                  id
                  name
                  type
                }
                value
              }
              eventMetadata {
                predictionId
                predictionLabel
                predictionScore
                actualLabel
                actualScore
              }
              promptAndResponse {
                prompt
                response
              }
              documentText
            }
          }
          corpusDataset {
            events(eventIds: $corpusEventIds) {
              id
              dimensions {
                dimension {
                  name
                  type
                }
                value
              }
              eventMetadata {
                predictionId
                predictionLabel
                predictionScore
                actualLabel
                actualScore
              }
              promptAndResponse {
                prompt
                response
              }
              documentText
            }
          }
        }
      }
    `,
    {
      primaryEventIds: primaryEventIds,
      referenceEventIds: referenceEventIds,
      corpusEventIds: corpusEventIds,
    }
  ).toPromise();
  // Construct a map of point id to the event data
  const primaryEvents = data?.model?.primaryDataset?.events ?? [];
  const referenceEvents = data?.model?.referenceDataset?.events ?? [];
  const corpusEvents = data?.model?.corpusDataset?.events ?? [];
  const allEvents = [...primaryEvents, ...referenceEvents, ...corpusEvents];
  return allEvents.reduce((acc, event) => {
    acc[event.id] = event;
    return acc;
  }, {} as PointDataMap);
}

async function fetchClusters({
  metric,
  points,
  hdbscanParameters,
}: {
  metric: MetricDefinition;
  points: readonly Point[];
  hdbscanParameters: HDBSCANParameters;
}): Promise<readonly ClusterInput[]> {
  const data = await fetchQuery<pointCloudStore_clustersQuery>(
    RelayEnvironment,
    graphql`
      query pointCloudStore_clustersQuery(
        $eventIds: [ID!]!
        $coordinates: [InputCoordinate3D!]!
        $minClusterSize: Int!
        $clusterMinSamples: Int!
        $clusterSelectionEpsilon: Float!
        $fetchDataQualityMetric: Boolean!
        $dataQualityMetricColumnName: String
        $fetchPerformanceMetric: Boolean!
        $performanceMetric: PerformanceMetric!
      ) {
        hdbscanClustering(
          eventIds: $eventIds
          coordinates3d: $coordinates
          minClusterSize: $minClusterSize
          clusterMinSamples: $clusterMinSamples
          clusterSelectionEpsilon: $clusterSelectionEpsilon
        ) {
          id
          eventIds
          driftRatio
          primaryToCorpusRatio
          dataQualityMetric(
            metric: { metric: mean, columnName: $dataQualityMetricColumnName }
          ) @include(if: $fetchDataQualityMetric) {
            primaryValue
            referenceValue
          }
          performanceMetric(metric: { metric: $performanceMetric })
            @include(if: $fetchPerformanceMetric) {
            primaryValue
            referenceValue
          }
        }
      }
    `,
    {
      eventIds: points.map((point) => point.eventId),
      coordinates: points.map((p) => ({
        x: p.position[0],
        y: p.position[1],
        z: p.position[2],
      })),
      fetchDataQualityMetric: metric.type === "dataQuality",
      dataQualityMetricColumnName:
        metric.type === "dataQuality" ? metric.dimension.name : null,
      fetchPerformanceMetric: metric.type === "performance",
      // NB: fallback should never happen due to the conditional above
      performanceMetric:
        metric.type === "performance" ? metric.metric : "accuracyScore",
      ...hdbscanParameters,
    },
    {
      fetchPolicy: "network-only",
    }
  ).toPromise();
  return data?.hdbscanClustering ?? [];
}

/**
 * A function that re-computes the cluster metrics for the point cloud
 */
async function fetchClusterMetrics({
  metric,
  clusters,
  hdbscanParameters,
}: {
  metric: MetricDefinition;
  clusters: readonly Cluster[];
  hdbscanParameters: HDBSCANParameters;
}): Promise<readonly ClusterInput[]> {
  const data = await fetchQuery<pointCloudStore_clusterMetricsQuery>(
    RelayEnvironment,
    graphql`
      query pointCloudStore_clusterMetricsQuery(
        $clusters: [ClusterInput!]!
        $fetchDataQualityMetric: Boolean!
        $dataQualityMetricColumnName: String
        $fetchPerformanceMetric: Boolean!
        $performanceMetric: PerformanceMetric!
      ) {
        clusters(clusters: $clusters) {
          id
          eventIds
          driftRatio
          primaryToCorpusRatio
          dataQualityMetric(
            metric: { metric: mean, columnName: $dataQualityMetricColumnName }
          ) @include(if: $fetchDataQualityMetric) {
            primaryValue
            referenceValue
          }
          performanceMetric(metric: { metric: $performanceMetric })
            @include(if: $fetchPerformanceMetric) {
            primaryValue
            referenceValue
          }
        }
      }
    `,
    {
      clusters: clusters.map((cluster) => ({
        id: cluster.id,
        eventIds: cluster.eventIds,
      })),
      fetchDataQualityMetric: metric.type === "dataQuality",
      dataQualityMetricColumnName:
        metric.type === "dataQuality" ? metric.dimension.name : null,
      fetchPerformanceMetric: metric.type === "performance",
      performanceMetric:
        metric.type === "performance" ? metric.metric : "accuracyScore",
      ...hdbscanParameters,
    },
    {
      fetchPolicy: "network-only",
    }
  ).toPromise();
  return data?.clusters ?? [];
}

/**
 * A curried function that returns a sort function for the clusters given a sort config
 */
const clusterSortFn =
  (sort: ClusterSort) =>
  (clusterA: Cluster, clusterB: Cluster): number => {
    const { dir, column } = sort;
    const isAsc = dir === "asc";
    const valueA = clusterA[column];
    const valueB = clusterB[column];
    if (valueA == null) {
      // Always place null values at the end
      return 1;
    } else if (valueB == null) {
      return -1;
    } else if (valueA > valueB) {
      return isAsc ? 1 : -1;
    } else if (valueA < valueB) {
      return isAsc ? -1 : 1;
    }
    return 0;
  };

/**
 * Normalize the cluster data
 */
function normalizeCluster(cluster: ClusterInput): Cluster {
  let primaryMetricValue = cluster.driftRatio,
    referenceMetricValue = null;
  if (cluster.dataQualityMetric) {
    primaryMetricValue = cluster.dataQualityMetric.primaryValue;
    referenceMetricValue = cluster.dataQualityMetric.referenceValue;
  } else if (cluster.performanceMetric) {
    primaryMetricValue = cluster.performanceMetric.primaryValue;
    referenceMetricValue = cluster.performanceMetric.referenceValue;
  } else if (cluster.primaryToCorpusRatio != null) {
    // TODO(mikeldking): make the metric declarative via a parameter
    // convert the -1 to 1 value to a 0 to 100 value
    primaryMetricValue = ((cluster.primaryToCorpusRatio + 1) / 2) * 100;
  }
  return {
    ...cluster,
    size: cluster.eventIds.length,
    primaryMetricValue: primaryMetricValue,
    referenceMetricValue: referenceMetricValue,
  };
}
