import { installTestStorage } from "@phoenix/__tests__/installTestStorage";

import { createProjectStore } from "../projectStore";

installTestStorage();

const PROJECT_ID = "UHJvamVjdDox";
const STORAGE_KEY = `arize-phoenix-project-${PROJECT_ID}`;

describe("projectStore metricChartKeys", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}-evaluator-compare`);
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
  it("isolates comparison display defaults and saved preferences from project tabs", () => {
    const project = createProjectStore({ projectId: PROJECT_ID });
    project.state
      .getState()
      .setMetricChartKeys("spans", ["spans_annotation:quality"]);
    const comparison = createProjectStore({
      projectId: PROJECT_ID,
      scope: "evaluator-compare",
      showTableAside: false,
      metricChartKeys: { spans: [], traces: [], sessions: [] },
    });
    expect(comparison.state.getState().showTableAside).toBe(false);
    expect(comparison.state.getState().metricChartKeys.spans).toEqual([]);
    comparison.state.getState().setShowTableAside(true);
    comparison.state
      .getState()
      .setMetricChartKeys("spans", ["spans_annotation:comparison"]);
    const restored = createProjectStore({
      projectId: PROJECT_ID,
      scope: "evaluator-compare",
      showTableAside: false,
    });
    expect(restored.state.getState().showTableAside).toBe(true);
    expect(restored.state.getState().metricChartKeys.spans).toEqual([
      "spans_annotation:comparison",
    ]);
    expect(
      createProjectStore({ projectId: PROJECT_ID }).state.getState()
        .metricChartKeys.spans
    ).toEqual(["spans_annotation:quality"]);
  });
});
