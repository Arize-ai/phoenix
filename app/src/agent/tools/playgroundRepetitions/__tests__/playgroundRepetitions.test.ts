import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  createSetPlaygroundRepetitionsClientAction,
  parseSetPlaygroundRepetitionsInput,
} from "@phoenix/agent/tools/playgroundRepetitions";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

installTestStorage();

describe("playground repetitions agent tool", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("parses valid repetition counts", () => {
    expect(parseSetPlaygroundRepetitionsInput({ repetitions: 1 })).toEqual({
      repetitions: 1,
    });
    expect(parseSetPlaygroundRepetitionsInput({ repetitions: 30 })).toEqual({
      repetitions: 30,
    });
  });

  it("rejects invalid repetition counts", () => {
    expect(parseSetPlaygroundRepetitionsInput({ repetitions: 0 })).toBeNull();
    expect(parseSetPlaygroundRepetitionsInput({ repetitions: 31 })).toBeNull();
    expect(parseSetPlaygroundRepetitionsInput({ repetitions: 1.5 })).toBeNull();
    expect(parseSetPlaygroundRepetitionsInput({ repetitions: "3" })).toBeNull();
  });

  it("sets playground repetitions", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetPlaygroundRepetitionsClientAction({
      playgroundStore,
    });

    const result = await action({ repetitions: 3 });

    expect(result.ok).toBe(true);
    expect(playgroundStore.getState().repetitions).toBe(3);
    if (!result.ok) return;
    expect(JSON.parse(result.output ?? "")).toEqual(
      expect.objectContaining({
        status: "updated",
        previousRepetitions: 1,
        repetitions: 3,
      })
    );
  });

  it("rejects invalid input without changing repetitions", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetPlaygroundRepetitionsClientAction({
      playgroundStore,
    });

    const result = await action({ repetitions: 31 });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid set_playground_repetitions input.",
      })
    );
    expect(playgroundStore.getState().repetitions).toBe(1);
  });

  it("rejects changes while the playground is running", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().runPlaygroundInstances();
    const action = createSetPlaygroundRepetitionsClientAction({
      playgroundStore,
    });

    const result = await action({ repetitions: 3 });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("already running"),
      })
    );
    expect(playgroundStore.getState().repetitions).toBe(1);
  });
});
