import { css } from "@emotion/react";
import type { ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";

import { View } from "@phoenix/components";
import { transparentResizeHandleCSS } from "@phoenix/components/resize";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { getExperimentMetricCharts } from "@phoenix/pages/dataset/metrics/chartCatalog";

const CHARTS_PANEL_DEFAULT_SIZE_PIXELS = 230;
const CHARTS_PANEL_MIN_SIZE_PIXELS = 160;
const CHARTS_PANEL_MAX_SIZE = "60%";

const PANEL_IDS_WITH_CHARTS = ["metrics-charts", "table-content"];
const PANEL_IDS_WITHOUT_CHARTS = ["table-content"];

/**
 * Pull the following panel up by the handle's height so the handle adds no
 * layout height of its own — it overlays the top of the table content's
 * padding instead. Keeps the vertical rhythm around the toolbar consistent
 * while preserving the handle's hover/drag hit area.
 */
const chartsResizeHandleCSS = css`
  margin-bottom: calc(-1 * var(--resize-handle-size));
  position: relative;
  z-index: 1;
`;

const chartsGridCSS = css`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: var(--global-dimension-size-100);
  height: 100%;
`;

/**
 * A strip of user-selected metric charts shown above the experiments table.
 * Any chart in the experiment metric chart catalog can be added. The
 * selection is persisted per dataset.
 */
export function ExperimentsMetricsCharts() {
  const datasetId = useDatasetContext((state) => state.datasetId);
  const selectedChartKeys = useDatasetContext(
    (state) => state.experimentsMetricChartKeys
  );
  const charts = getExperimentMetricCharts(selectedChartKeys);
  return (
    <View
      paddingStart="size-200"
      paddingEnd="size-200"
      paddingTop="size-100"
      height="100%"
      overflow="visible"
      position="relative"
      zIndex={2}
    >
      <div css={chartsGridCSS}>
        {charts.map(({ key, annotationName, Panel }) => (
          <Panel
            key={key}
            datasetId={datasetId}
            annotationName={annotationName}
            fillHeight
          />
        ))}
      </div>
    </View>
  );
}

/**
 * Lays out the experiment metric charts strip above the experiments table in
 * a vertically resizable panel group. A transparent drag handle sits between
 * the charts and the table content so the charts can be resized to take up
 * more or less vertical space. When no charts are selected the charts panel
 * and handle are not rendered and the table content fills the space.
 */
export function ExperimentsMetricsChartsPanelGroup({
  children,
}: {
  children: ReactNode;
}) {
  // The store guarantees keys are valid catalog keys, so any selection means
  // there are charts to show
  const hasCharts = useDatasetContext(
    (state) => state.experimentsMetricChartKeys.length > 0
  );
  // Persist the layout so the charts strip keeps its height across reloads
  // and remounts instead of resetting to the default
  const layoutId = "experiments-table-metrics-layout";
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: layoutId,
    panelIds: hasCharts ? PANEL_IDS_WITH_CHARTS : PANEL_IDS_WITHOUT_CHARTS,
    storage: localStorage,
  });
  return (
    <Group
      orientation="vertical"
      id={layoutId}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      {hasCharts && (
        <>
          <Panel
            id="metrics-charts"
            defaultSize={CHARTS_PANEL_DEFAULT_SIZE_PIXELS}
            minSize={CHARTS_PANEL_MIN_SIZE_PIXELS}
            maxSize={CHARTS_PANEL_MAX_SIZE}
            groupResizeBehavior="preserve-pixel-size"
            style={{ overflow: "visible" }}
          >
            <ExperimentsMetricsCharts />
          </Panel>
          <Separator
            css={[transparentResizeHandleCSS, chartsResizeHandleCSS]}
          />
        </>
      )}
      <Panel id="table-content">{children}</Panel>
    </Group>
  );
}
