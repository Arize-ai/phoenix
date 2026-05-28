import { createRunPlaygroundClientAction } from "@phoenix/agent/tools/playgroundRun";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

describe("playground run agent tool", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("starts a playground run for all current instances", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().addInstance();
    const action = createRunPlaygroundClientAction({ playgroundStore });

    const result = await action({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const output = JSON.parse(result.output ?? "") as {
      status: string;
      instances: { instanceId: number; label: string }[];
    };
    expect(output).toEqual(
      expect.objectContaining({
        status: "started",
        instances: [
          { instanceId: 0, label: "A" },
          { instanceId: 1, label: "B" },
        ],
      })
    );
    expect(
      playgroundStore
        .getState()
        .instances.every((instance) => instance.activeRunId != null)
    ).toBe(true);
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

  it("rejects unexpected input fields", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createRunPlaygroundClientAction({ playgroundStore });

    const result = await action({ instanceId: 0 });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid run_playground input.",
      })
    );
  });
});
