import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { createSetAppendedMessagesPathClientAction } from "@phoenix/agent/tools/playgroundAppendedMessagesPath";
import { createPlaygroundStore } from "@phoenix/store/playground";

installTestStorage();

describe("playground appended messages path agent tool", () => {
  it("(a) non-experiment: resolves datasetId from the URL even when store.datasetId is null", async () => {
    // store.datasetId stays null for a URL-deep-linked dataset.
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetAppendedMessagesPathClientAction({
      playgroundStore,
      getSearchParams: () => new URLSearchParams("datasetId=ds-url"),
    });

    const result = await action({ path: "messages" });

    expect(result.ok).toBe(true);
    expect(playgroundStore.getState().datasetId).toBeNull();
    expect(
      playgroundStore.getState().stateByDatasetId["ds-url"]
        ?.appendedMessagesPath
    ).toBe("messages");
  });

  it("(b) experiment mode: resolves datasetId from the store", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: "ds-store",
      modelConfigByProvider: {},
    });
    const action = createSetAppendedMessagesPathClientAction({
      playgroundStore,
      getSearchParams: () =>
        new URLSearchParams("experimentId=exp-1&datasetId=ds-url"),
    });

    const result = await action({ path: "conversation" });

    expect(result.ok).toBe(true);
    expect(
      playgroundStore.getState().stateByDatasetId["ds-store"]
        ?.appendedMessagesPath
    ).toBe("conversation");
    expect(
      playgroundStore.getState().stateByDatasetId["ds-url"]
    ).toBeUndefined();
  });

  it("(c) no resolved dataset: returns the load-dataset nudge", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetAppendedMessagesPathClientAction({
      playgroundStore,
      getSearchParams: () => new URLSearchParams(),
    });

    const result = await action({ path: "messages" });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "No dataset is loaded; call load_dataset first.",
      })
    );
  });

  it("(d) invalid input: returns ok:false without writing", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetAppendedMessagesPathClientAction({
      playgroundStore,
      getSearchParams: () => new URLSearchParams("datasetId=ds-url"),
    });

    const result = await action({ path: 42 });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid set_appended_messages_path input.",
      })
    );
    expect(
      playgroundStore.getState().stateByDatasetId["ds-url"]
    ).toBeUndefined();
  });

  it("normalizes an empty path to null (disabled)", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetAppendedMessagesPathClientAction({
      playgroundStore,
      getSearchParams: () => new URLSearchParams("datasetId=ds-url"),
    });

    const result = await action({ path: "" });

    expect(result.ok).toBe(true);
    expect(
      playgroundStore.getState().stateByDatasetId["ds-url"]
        ?.appendedMessagesPath
    ).toBeNull();
  });

  it("rejects off-contract extra keys (strict)", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetAppendedMessagesPathClientAction({
      playgroundStore,
      getSearchParams: () => new URLSearchParams("datasetId=ds-url"),
    });

    const result = await action({ path: "messages", extra: "nope" });

    expect(result.ok).toBe(false);
  });
});
