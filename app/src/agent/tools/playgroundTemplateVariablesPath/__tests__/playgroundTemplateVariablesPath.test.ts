import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { createSetTemplateVariablesPathClientAction } from "@phoenix/agent/tools/playgroundTemplateVariablesPath";
import { createPlaygroundStore } from "@phoenix/store/playground";

installTestStorage();

describe("playground template variables path agent tool", () => {
  it("writes per-dataset state under the URL datasetId when the store copy is null (non-experiment)", async () => {
    const urlDatasetId = "url-dataset";
    // store.datasetId is null even though a dataset is loaded via URL deep link
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetTemplateVariablesPathClientAction({
      playgroundStore,
      getSearchParams: () => new URLSearchParams({ datasetId: urlDatasetId }),
    });

    const result = await action({ path: "input.context" });

    expect(result.ok).toBe(true);
    expect(
      playgroundStore.getState().stateByDatasetId[urlDatasetId]
        .templateVariablesPath
    ).toBe("input.context");
  });

  it("resolves the datasetId from the store in experiment mode", async () => {
    const experimentDatasetId = "experiment-dataset";
    const playgroundStore = createPlaygroundStore({
      datasetId: experimentDatasetId,
      modelConfigByProvider: {},
    });
    const action = createSetTemplateVariablesPathClientAction({
      playgroundStore,
      // experimentId present, no datasetId searchParam → must read store.datasetId
      getSearchParams: () =>
        new URLSearchParams({ experimentId: "some-experiment" }),
    });

    const result = await action({ path: "reference.answer" });

    expect(result.ok).toBe(true);
    expect(
      playgroundStore.getState().stateByDatasetId[experimentDatasetId]
        .templateVariablesPath
    ).toBe("reference.answer");
  });

  it("normalizes an empty path to null (example root)", async () => {
    const urlDatasetId = "url-dataset";
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetTemplateVariablesPathClientAction({
      playgroundStore,
      getSearchParams: () => new URLSearchParams({ datasetId: urlDatasetId }),
    });

    const result = await action({ path: "" });

    expect(result.ok).toBe(true);
    expect(
      playgroundStore.getState().stateByDatasetId[urlDatasetId]
        .templateVariablesPath
    ).toBeNull();
  });

  it("returns a load-a-dataset nudge when no dataset is resolved", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetTemplateVariablesPathClientAction({
      playgroundStore,
      // no datasetId searchParam and no experiment → no resolved dataset
      getSearchParams: () => new URLSearchParams(),
    });

    const result = await action({ path: "input.context" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/load a dataset first/i);
    }
    expect(playgroundStore.getState().stateByDatasetId).toEqual({});
  });

  it("rejects off-contract input (extra key) via .strict()", async () => {
    const urlDatasetId = "url-dataset";
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetTemplateVariablesPathClientAction({
      playgroundStore,
      getSearchParams: () => new URLSearchParams({ datasetId: urlDatasetId }),
    });

    const result = await action({ path: "input.context", extra: "nope" });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid set_template_variables_path input.",
      })
    );
    expect(playgroundStore.getState().stateByDatasetId).toEqual({});
  });
});
