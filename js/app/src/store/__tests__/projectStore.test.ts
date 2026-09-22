import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { DEFAULT_METRIC_CHART_KEYS } from "@phoenix/pages/project/constants";

import { createProjectStore } from "../projectStore";

installTestStorage();

const PROJECT_ID = "UHJvamVjdDox";
const STORAGE_KEY = `arize-phoenix-project-${PROJECT_ID}`;
const SCOPE = "secondary";

describe("projectStore metricChartKeys", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}-${SCOPE}`);
  });

  it("retains per-annotation chart keys while dropping invalid persisted keys", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          metricChartKeys: {
            spans: ["spans_annotation:quality", "bogus_chart"],
          },
        },
        version: 0,
      })
    );

    const store = createProjectStore({ projectId: PROJECT_ID });

    expect(store.state.getState().metricChartKeys.spans).toEqual([
      "spans_annotation:quality",
    ]);
  });
  it("keeps a scoped store's defaults and saved preferences separate", () => {
    const unscoped = createProjectStore({ projectId: PROJECT_ID });
    unscoped.state
      .getState()
      .setMetricChartKeys("spans", ["spans_annotation:quality"]);
    const scoped = createProjectStore({
      projectId: PROJECT_ID,
      scope: SCOPE,
      showTableAside: false,
    });
    expect(scoped.state.getState().showTableAside).toBe(false);
    expect(scoped.state.getState().metricChartKeys.spans).toEqual(
      DEFAULT_METRIC_CHART_KEYS.spans
    );
    scoped.state.getState().setShowTableAside(true);
    scoped.state
      .getState()
      .setMetricChartKeys("spans", ["spans_annotation:scoped"]);
    const restored = createProjectStore({
      projectId: PROJECT_ID,
      scope: SCOPE,
      showTableAside: false,
    });
    expect(restored.state.getState().showTableAside).toBe(true);
    expect(restored.state.getState().metricChartKeys.spans).toEqual([
      "spans_annotation:scoped",
    ]);
    expect(
      createProjectStore({ projectId: PROJECT_ID }).state.getState()
        .metricChartKeys.spans
    ).toEqual(["spans_annotation:quality"]);
  });
});
