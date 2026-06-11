import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  createSetPlaygroundExperimentRecordingClientAction,
  parseSetPlaygroundExperimentRecordingInput,
} from "@phoenix/agent/tools/playgroundExperimentRecording";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

installTestStorage();

describe("playground experiment recording agent tool", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("parses boolean recording modes", () => {
    expect(
      parseSetPlaygroundExperimentRecordingInput({ recordExperiments: true })
    ).toEqual({ recordExperiments: true });
    expect(
      parseSetPlaygroundExperimentRecordingInput({ recordExperiments: false })
    ).toEqual({ recordExperiments: false });
  });

  it("parses optional experiment scaffold fields", () => {
    expect(
      parseSetPlaygroundExperimentRecordingInput({
        recordExperiments: true,
        experimentName: "Shorter system prompt",
        experimentDescription: "Trimmed the system prompt by half",
        experimentMetadata: { hypothesis: "fewer tokens, same accuracy" },
      })
    ).toEqual({
      recordExperiments: true,
      experimentName: "Shorter system prompt",
      experimentDescription: "Trimmed the system prompt by half",
      experimentMetadata: { hypothesis: "fewer tokens, same accuracy" },
    });
  });

  it("rejects invalid recording modes", () => {
    expect(
      parseSetPlaygroundExperimentRecordingInput({ recordExperiments: "true" })
    ).toBeNull();
    expect(parseSetPlaygroundExperimentRecordingInput({})).toBeNull();
    expect(
      parseSetPlaygroundExperimentRecordingInput({
        recordExperiments: true,
        extra: "nope",
      })
    ).toBeNull();
  });

  it("rejects scaffold fields of the wrong type", () => {
    expect(
      parseSetPlaygroundExperimentRecordingInput({
        recordExperiments: true,
        experimentName: 42,
      })
    ).toBeNull();
    expect(
      parseSetPlaygroundExperimentRecordingInput({
        recordExperiments: true,
        experimentMetadata: "not-an-object",
      })
    ).toBeNull();
  });

  it("enables persistent experiment recording", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().setRecordExperiments(false);
    const action = createSetPlaygroundExperimentRecordingClientAction({
      playgroundStore,
    });

    const result = await action({ recordExperiments: true });

    expect(result.ok).toBe(true);
    expect(playgroundStore.getState().recordExperiments).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.output ?? "")).toEqual(
      expect.objectContaining({
        status: "updated",
        previousRecordExperiments: false,
        recordExperiments: true,
        mode: "persistent",
      })
    );
  });

  it("stages the experiment scaffold for the next run", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetPlaygroundExperimentRecordingClientAction({
      playgroundStore,
    });

    const result = await action({
      recordExperiments: true,
      experimentName: "Shorter system prompt",
      experimentMetadata: { hypothesis: "fewer tokens, same accuracy" },
    });

    expect(result.ok).toBe(true);
    expect(playgroundStore.getState().nextExperimentScaffold).toEqual({
      name: "Shorter system prompt",
      metadata: { hypothesis: "fewer tokens, same accuracy" },
    });
    if (!result.ok) return;
    expect(JSON.parse(result.output ?? "")).toEqual(
      expect.objectContaining({
        status: "updated",
        recordExperiments: true,
        nextExperimentScaffold: {
          name: "Shorter system prompt",
          metadata: { hypothesis: "fewer tokens, same accuracy" },
        },
      })
    );
  });

  it("leaves the scaffold untouched when no scaffold fields are provided", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetPlaygroundExperimentRecordingClientAction({
      playgroundStore,
    });

    await action({ recordExperiments: true });

    expect(playgroundStore.getState().nextExperimentScaffold).toBeNull();
  });

  it("consumes the staged scaffold once, then clears it", () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore
      .getState()
      .setNextExperimentScaffold({ name: "Run with notes" });

    const consumed = playgroundStore.getState().consumeNextExperimentScaffold();

    expect(consumed).toEqual({ name: "Run with notes" });
    expect(playgroundStore.getState().nextExperimentScaffold).toBeNull();
    expect(
      playgroundStore.getState().consumeNextExperimentScaffold()
    ).toBeNull();
  });

  it("disables persistent experiment recording", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetPlaygroundExperimentRecordingClientAction({
      playgroundStore,
    });

    const result = await action({ recordExperiments: false });

    expect(result.ok).toBe(true);
    expect(playgroundStore.getState().recordExperiments).toBe(false);
    if (!result.ok) return;
    expect(JSON.parse(result.output ?? "")).toEqual(
      expect.objectContaining({
        status: "updated",
        previousRecordExperiments: true,
        recordExperiments: false,
        mode: "ephemeral",
      })
    );
  });

  it("rejects invalid input without changing recording mode", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetPlaygroundExperimentRecordingClientAction({
      playgroundStore,
    });

    const result = await action({ recordExperiments: "false" });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid set_playground_experiment_recording input.",
      })
    );
    expect(playgroundStore.getState().recordExperiments).toBe(true);
  });

  it("rejects changes while the playground is running", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().runPlaygroundInstances();
    const action = createSetPlaygroundExperimentRecordingClientAction({
      playgroundStore,
    });

    const result = await action({ recordExperiments: false });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("already running"),
      })
    );
    expect(playgroundStore.getState().recordExperiments).toBe(true);
  });
});
