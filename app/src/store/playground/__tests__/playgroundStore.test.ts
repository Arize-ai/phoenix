import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";

import {
  _resetInstanceId,
  createNormalizedPlaygroundInstance,
  createPlaygroundStore,
  getInitialInstances,
} from "../playgroundStore";
import type { InitialPlaygroundState } from "../types";

describe("getInitialInstances", () => {
  beforeEach(() => {
    _resetInstanceId();
  });
  it("should return instances from initialProps if they exist", () => {
    const {
      instance: newInstanceParams,
      instanceMessages: newInstanceMessages,
    } = createNormalizedPlaygroundInstance();
    const newInstance = {
      ...newInstanceParams,
      template: {
        ...newInstanceParams.template,
        // denormalize messages to simulate a denormalized instance
        messages: Object.values(newInstanceMessages),
      },
      model: {
        modelName: "test-model",
        provider: "OPENAI" as const,
        invocationParameters: [],
        supportedInvocationParameters: [],
      },
    };

    // simulated props that would be passed to the PlaygroundProvider
    const initialProps: InitialPlaygroundState = {
      instances: [newInstance],
      modelConfigByProvider: {},
    };

    // Create normalized instances from the denormalized instance
    const { instances, instanceMessages } = getInitialInstances(initialProps);

    expect(instances).toEqual([
      {
        ...newInstanceParams,
        model: { ...newInstanceParams.model, modelName: "test-model" },
      },
    ]);

    // the denormalized instance messages should end up in the instanceMessages object
    expect(instanceMessages).toEqual(newInstanceMessages);
  });

  it("should create a new default instance if no instances exist in initialProps and there are no saved modelConfigs", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
    };
    const { instances } = getInitialInstances(initialProps);

    expect(instances).toHaveLength(1);
    expect(instances[0].id).toBe(0);
    expect(instances[0].model.provider).toBe(DEFAULT_MODEL_PROVIDER);
    expect(instances[0].model.modelName).toBe(DEFAULT_MODEL_NAME);
  });

  it("should use saved model config if available", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {
        OPENAI: {
          modelName: "test-model",
          provider: "OPENAI",
          invocationParameters: [],
        },
      },
    };

    const { instances } = getInitialInstances(initialProps);

    expect(instances).toHaveLength(1);
    expect(instances[0].model.provider).toBe("OPENAI");
    expect(instances[0].model.modelName).toBe("test-model");
  });

  it("should use default model provider config if available", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {
        OPENAI: {
          modelName: "test-model-openai",
          provider: "OPENAI",
          invocationParameters: [],
        },
        ANTHROPIC: {
          modelName: "test-model-anthropic",
          provider: "ANTHROPIC",
          invocationParameters: [],
        },
      },
    };

    const { instances } = getInitialInstances(initialProps);

    expect(instances).toHaveLength(1);
    expect(instances[0].model.provider).toBe("OPENAI");
    expect(instances[0].model.modelName).toBe("test-model-openai");
  });

  it("should use any saved config if available if the default provider config is not", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {
        ANTHROPIC: {
          modelName: "test-model-anthropic",
          provider: "ANTHROPIC",
          invocationParameters: [],
        },
      },
    };

    const { instances } = getInitialInstances(initialProps);

    expect(instances).toHaveLength(1);
    expect(instances[0].model.provider).toBe("ANTHROPIC");
    expect(instances[0].model.modelName).toBe("test-model-anthropic");
  });
});

describe("setSelectedRepetitionNumber", () => {
  it("should set selected repetition number for an instance", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().addInstance();
    const instanceId = store.getState().instances[1].id; // update second instance
    expect(store.getState().instances[0].selectedRepetitionNumber).toBe(1);
    expect(store.getState().instances[1].selectedRepetitionNumber).toBe(1);
    store.getState().setSelectedRepetitionNumber(instanceId, 2);
    expect(store.getState().instances[0].selectedRepetitionNumber).toBe(1); // first instance should not be updated
    expect(store.getState().instances[1].selectedRepetitionNumber).toBe(2); // second instance should be updated
  });
});
