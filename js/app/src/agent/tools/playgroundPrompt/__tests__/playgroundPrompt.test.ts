import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  createAddPromptInstanceClientAction,
  createClonePromptInstanceClientAction,
} from "@phoenix/agent/tools/playgroundPrompt";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

installTestStorage();

describe("playground prompt agent tools", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-assistant");
    _resetInstanceId();
    _resetMessageId();
  });

  it("rejects clone_prompt_instance when the playground already has four instances", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const cloneAction = createClonePromptInstanceClientAction({
      playgroundStore,
    });
    playgroundStore.getState().addInstance();
    playgroundStore.getState().addInstance();
    playgroundStore.getState().addInstance();
    expect(playgroundStore.getState().instances).toHaveLength(4);

    const result = await cloneAction({ instanceId: 0 });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("at most 4"),
      })
    );
    expect(playgroundStore.getState().instances).toHaveLength(4);
  });

  it("rejects add_prompt_instance when the playground already has four instances", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const addAction = createAddPromptInstanceClientAction({ playgroundStore });
    playgroundStore.getState().addInstance();
    playgroundStore.getState().addInstance();
    playgroundStore.getState().addInstance();

    const result = await addAction({});

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("at most 4"),
      })
    );
    expect(playgroundStore.getState().instances).toHaveLength(4);
  });

  it("rejects add_prompt_instance while playground instances are running", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const addAction = createAddPromptInstanceClientAction({ playgroundStore });
    playgroundStore.getState().runPlaygroundInstances();

    const result = await addAction({});

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("while the playground is running"),
      })
    );
    expect(playgroundStore.getState().instances).toHaveLength(1);
  });
});
