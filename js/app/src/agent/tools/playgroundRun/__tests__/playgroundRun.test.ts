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

    const resultPromise = action({ instanceId: 0 });
    for (const instance of playgroundStore.getState().instances) {
      playgroundStore.getState().markPlaygroundInstanceComplete(instance.id);
    }

    const result = await resultPromise;
    expect(result.ok).toBe(true);
  });

  it("resolves only once every instance finishes its run", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().addInstance();
    const action = createRunPlaygroundClientAction({ playgroundStore });

    let isResolved = false;
    const resultPromise = action({}).then((result) => {
      isResolved = true;
      return result;
    });
    // Flush microtasks: the run has started but no instance has finished.
    await Promise.resolve();
    await Promise.resolve();
    expect(isResolved).toBe(false);

    // Two instances (the default plus addInstance): finishing only the first
    // must not resolve the run.
    const [first, ...rest] = playgroundStore.getState().instances;
    expect(rest.length).toBeGreaterThan(0);
    playgroundStore.getState().markPlaygroundInstanceComplete(first.id);
    await Promise.resolve();
    await Promise.resolve();
    expect(isResolved).toBe(false);
    for (const instance of rest) {
      playgroundStore.getState().markPlaygroundInstanceComplete(instance.id);
    }

    const result = await resultPromise;
    expect(result).toMatchObject({
      ok: true,
      output: expect.objectContaining({
        status: "completed",
        message: expect.stringContaining("finished"),
      }),
    });
  });

  it("resolves when the user cancels the run", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createRunPlaygroundClientAction({ playgroundStore });

    const resultPromise = action({});
    await Promise.resolve();
    playgroundStore.getState().cancelPlaygroundInstances();

    const result = await resultPromise;
    expect(result).toMatchObject({
      ok: true,
      output: expect.objectContaining({ status: "completed" }),
    });
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
