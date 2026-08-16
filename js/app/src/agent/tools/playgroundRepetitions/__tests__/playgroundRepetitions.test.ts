import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  createSetPlaygroundRepetitionsClientAction,
  parseSetPlaygroundRepetitionsInput,
} from "@phoenix/agent/tools/playgroundRepetitions";
import {
  NUM_MAX_PLAYGROUND_REPETITIONS,
  NUM_MIN_PLAYGROUND_REPETITIONS,
} from "@phoenix/pages/playground/constants";
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
    expect(
      parseSetPlaygroundRepetitionsInput({
        repetitions: NUM_MIN_PLAYGROUND_REPETITIONS,
      })
    ).toEqual({
      repetitions: NUM_MIN_PLAYGROUND_REPETITIONS,
    });
    expect(
      parseSetPlaygroundRepetitionsInput({
        repetitions: NUM_MAX_PLAYGROUND_REPETITIONS,
      })
    ).toEqual({
      repetitions: NUM_MAX_PLAYGROUND_REPETITIONS,
    });
  });

  it("rejects invalid repetition counts", () => {
    expect(
      parseSetPlaygroundRepetitionsInput({
        repetitions: NUM_MIN_PLAYGROUND_REPETITIONS - 1,
      })
    ).toBeNull();
    expect(
      parseSetPlaygroundRepetitionsInput({
        repetitions: NUM_MAX_PLAYGROUND_REPETITIONS + 1,
      })
    ).toBeNull();
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

    const result = await action({
      repetitions: NUM_MAX_PLAYGROUND_REPETITIONS + 1,
    });

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
