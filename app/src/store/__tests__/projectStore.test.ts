import { installTestStorage } from "@phoenix/__tests__/installTestStorage";

import { createProjectStore } from "../projectStore";

installTestStorage();

const PROJECT_ID = "UHJvamVjdDox";
const STORAGE_KEY = `arize-phoenix-project-${PROJECT_ID}`;

describe("projectStore metricChartKeys", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("retains per-evaluation chart keys while dropping invalid persisted keys", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          metricChartKeys: {
            spans: ["spans_evaluation:quality", "bogus_chart"],
          },
        },
        version: 0,
      })
    );

    const store = createProjectStore({ projectId: PROJECT_ID });

    expect(store.state.getState().metricChartKeys.spans).toEqual([
      "spans_evaluation:quality",
    ]);
  });
});
