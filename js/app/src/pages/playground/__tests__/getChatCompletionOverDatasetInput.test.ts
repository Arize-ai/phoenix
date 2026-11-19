import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { getChatCompletionOverDatasetInput } from "@phoenix/pages/playground/playgroundUtils";
import { createCredentialsStore, createPlaygroundStore } from "@phoenix/store";

installTestStorage();

const DATASET_ID = "ds-1";

function getInput({
  playgroundStore,
}: {
  playgroundStore: ReturnType<typeof createPlaygroundStore>;
}) {
  const credentials = createCredentialsStore({}).getState();
  const instanceId = playgroundStore.getState().instances[0].id;
  return getChatCompletionOverDatasetInput({
    playgroundStore,
    instanceId,
    credentials,
    datasetId: DATASET_ID,
    evaluatorMappings: {},
  });
}

describe("getChatCompletionOverDatasetInput experiment identity", () => {
  it("uses persisted UI name and description when the scaffold is empty", () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: DATASET_ID,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().setExperimentName({
      experimentName: "  ui-name  ",
      datasetId: DATASET_ID,
    });
    playgroundStore.getState().setExperimentDescription({
      experimentDescription: "  ui-description  ",
      datasetId: DATASET_ID,
    });

    const input = getInput({ playgroundStore });

    expect(input.experimentName).toBe("ui-name");
    expect(input.experimentDescription).toBe("ui-description");
  });

  it("lets the agent scaffold override UI name and description for that run", () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: DATASET_ID,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().setExperimentName({
      experimentName: "ui-name",
      datasetId: DATASET_ID,
    });
    playgroundStore.getState().setExperimentDescription({
      experimentDescription: "ui-description",
      datasetId: DATASET_ID,
    });
    playgroundStore.getState().setNextExperimentScaffold({
      name: "agent-name",
      description: "agent-description",
    });

    const input = getInput({ playgroundStore });

    expect(input.experimentName).toBe("agent-name");
    expect(input.experimentDescription).toBe("agent-description");
  });

  it("sends null when both scaffold and UI identity are unset", () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: DATASET_ID,
      modelConfigByProvider: {},
    });

    const input = getInput({ playgroundStore });

    expect(input.experimentName).toBeNull();
    expect(input.experimentDescription).toBeNull();
  });
});
