import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { createReadPlaygroundOutputClientAction } from "@phoenix/agent/tools/playgroundOutput";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

installTestStorage();

describe("playground output agent tool", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("reads raw playground output and trace id for completed runs", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const instanceId = playgroundStore.getState().instances[0].id;
    playgroundStore.getState().runPlaygroundInstances();
    playgroundStore
      .getState()
      .appendRepetitionOutput(instanceId, 1, "Playground answer");
    playgroundStore
      .getState()
      .setRepetitionSpanId(instanceId, 1, "span-node-id");
    playgroundStore
      .getState()
      .setRepetitionTraceId(instanceId, 1, "trace-otel-id");
    playgroundStore.getState().setRepetitionStatus(instanceId, 1, "finished");
    playgroundStore.getState().markPlaygroundInstanceComplete(instanceId);
    const action = createReadPlaygroundOutputClientAction({ playgroundStore });

    const result = await action({});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const output: {
      status: string;
      instances: {
        instanceId: number;
        label: string;
        repetitions: {
          rawOutput: string;
          traceId: string;
          spanNodeId: string;
        }[];
      }[];
    } = JSON.parse(result.output ?? "");
    expect(output).toEqual(
      expect.objectContaining({
        status: "finished",
        instances: [
          expect.objectContaining({
            instanceId,
            label: "A",
            repetitions: [
              expect.objectContaining({
                rawOutput: "Playground answer",
                traceId: "trace-otel-id",
                spanNodeId: "span-node-id",
              }),
            ],
          }),
        ],
      })
    );
  });

  it("rejects reads before any run data is available", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createReadPlaygroundOutputClientAction({ playgroundStore });

    const result = await action({});

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("No playground run output"),
      })
    );
  });

  it("rejects unexpected input fields", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createReadPlaygroundOutputClientAction({ playgroundStore });

    const result = await action({ instanceId: 0, extra: true });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid read_playground_output input.",
      })
    );
  });
});
