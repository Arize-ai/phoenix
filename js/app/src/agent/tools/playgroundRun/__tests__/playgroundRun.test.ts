import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  createCancelPlaygroundRunClientAction,
  createRunPlaygroundClientAction,
} from "@phoenix/agent/tools/playgroundRun";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

installTestStorage();

describe("playground run agent tool", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("rejects run requests while the playground is already running", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().runPlaygroundInstances();
    const action = createRunPlaygroundClientAction({ playgroundStore });

    const result = await action({});

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("already running"),
      })
    );
  });

  it("ignores stray input fields on this no-argument tool", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().addInstance();
    const action = createRunPlaygroundClientAction({ playgroundStore });

    const result = await action({ instanceId: 0 });

    expect(result.ok).toBe(true);
  });

  it("rejects cancel requests when the playground is not running", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createCancelPlaygroundRunClientAction({ playgroundStore });

    const result = await action({});

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("not running"),
      })
    );
  });
});
