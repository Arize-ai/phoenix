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
    const instanceId = store.getState().instances[1].id; // id of second instance

    // verify initial selected repetition numbers
    expect(store.getState().instances[0].selectedRepetitionNumber).toBe(1);
    expect(store.getState().instances[1].selectedRepetitionNumber).toBe(1);

    // set selected repetition number of second instance to 2
    store.getState().setSelectedRepetitionNumber(instanceId, 2);

    // verify
    expect(store.getState().instances[0].selectedRepetitionNumber).toBe(1); // first instance should not be updated
    expect(store.getState().instances[1].selectedRepetitionNumber).toBe(2); // second instance should be updated
  });
});

describe("appendRepetitionOutput", () => {
  it("should append content to null and existing output and preserve other repetitions", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().setRepetitions(2);
    store.getState().runPlaygroundInstances();
    const instanceId = store.getState().instances[0].id;

    // append to null output of first repetition
    expect(store.getState().instances[0].repetitions[1]!.output).toBe(null);
    store.getState().appendRepetitionOutput(instanceId, 1, "Hello");
    expect(store.getState().instances[0].repetitions[1]!.output).toBe("Hello");

    // append to existing output of first repetition
    store.getState().appendRepetitionOutput(instanceId, 1, " World");
    expect(store.getState().instances[0].repetitions[1]!.output).toBe(
      "Hello World"
    );

    // verify null output of second repetition is not affected
    expect(store.getState().instances[0].repetitions[2]!.output).toBe(null);
  });
});

describe("setRepetitionError", () => {
  it("should set repetition error and preserve other repetition properties", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().runPlaygroundInstances();
    const instanceId = store.getState().instances[0].id;

    // set up some properties on the repetition
    store.getState().appendRepetitionOutput(instanceId, 1, "Some output");
    store.getState().setRepetitionSpanId(instanceId, 1, "span-123");
    store.getState().setRepetitionStatus(instanceId, 1, "streamInProgress");

    // verify initial state
    let repetition = store.getState().instances[0].repetitions[1];
    expect(repetition!.output).toBe("Some output");
    expect(repetition!.spanId).toBe("span-123");
    expect(repetition!.status).toBe("streamInProgress");
    expect(repetition!.error).toBe(null);

    // set an error
    store.getState().setRepetitionError(instanceId, 1, {
      title: "API Error",
      message: "Rate limit exceeded",
    });

    // verify error is set
    repetition = store.getState().instances[0].repetitions[1];
    expect(repetition!.error).toEqual({
      title: "API Error",
      message: "Rate limit exceeded",
    });

    // verify other properties are preserved
    expect(repetition!.output).toBe("Some output");
    expect(repetition!.spanId).toBe("span-123");
    expect(repetition!.status).toBe("streamInProgress");
  });
});

describe("setRepetitionStatus", () => {
  it("should set repetition status", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().runPlaygroundInstances();
    const instanceId = store.getState().instances[0].id;

    // verify initial status is pending
    expect(store.getState().instances[0].repetitions[1]!.status).toBe(
      "pending"
    );

    // set to streamInProgress
    store.getState().setRepetitionStatus(instanceId, 1, "streamInProgress");
    expect(store.getState().instances[0].repetitions[1]!.status).toBe(
      "streamInProgress"
    );

    // set to finished
    store.getState().setRepetitionStatus(instanceId, 1, "finished");
    expect(store.getState().instances[0].repetitions[1]!.status).toBe(
      "finished"
    );
  });
});

describe("setRepetitionSpanId", () => {
  it("should set repetition span id", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().runPlaygroundInstances();
    const instanceId = store.getState().instances[0].id;

    // verify initial spanId is null
    expect(store.getState().instances[0].repetitions[1]!.spanId).toBe(null);

    // set span id
    store.getState().setRepetitionSpanId(instanceId, 1, "span-abc-123");
    expect(store.getState().instances[0].repetitions[1]!.spanId).toBe(
      "span-abc-123"
    );
  });
});
