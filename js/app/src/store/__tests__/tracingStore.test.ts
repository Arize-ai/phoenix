import { installTestStorage } from "@phoenix/__tests__/installTestStorage";

import { createTracingStore } from "../tracingStore";

installTestStorage();

const PROJECT_ID = "UHJvamVjdDox";
const STORAGE_KEY = `arize-phoenix-tracing-${PROJECT_ID}-spans`;

describe("tracingStore persistence", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("persists column preferences per project and table by default", () => {
    const store = createTracingStore({
      projectId: PROJECT_ID,
      tableId: "spans",
    });
    store.getState().setColumnVisibility({ name: false });
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").state
        .columnVisibility
    ).toEqual({ name: false });
  });

  it("neither reads nor writes storage when persistence is off", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { annotationColumnVisibility: { stale: true } },
        version: 0,
      })
    );
    const store = createTracingStore({
      projectId: PROJECT_ID,
      tableId: "spans",
      persistPreferences: false,
      annotationColumnVisibility: { current: true },
    });
    expect(store.getState().annotationColumnVisibility).toEqual({
      current: true,
    });
    store.getState().setAnnotationColumnVisibility({ current: false });
    expect(store.getState().annotationColumnVisibility).toEqual({
      current: false,
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").state).toEqual(
      { annotationColumnVisibility: { stale: true } }
    );
  });
});
