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

describe("addRepetitionPartialToolCall", () => {
  it("should add new tool call and concatenate arguments to existing tool call", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().runPlaygroundInstances();
    const instanceId = store.getState().instances[0].id;

    // verify initial toolCalls is empty
    expect(store.getState().instances[0].repetitions[1]!.toolCalls).toEqual({});

    // add a new partial tool call
    store.getState().addRepetitionPartialToolCall(instanceId, 1, {
      id: "call_1",
      function: {
        name: "get_weather",
        arguments: '{"location":',
      },
    });

    expect(store.getState().instances[0].repetitions[1]!.toolCalls).toEqual({
      call_1: {
        id: "call_1",
        function: {
          name: "get_weather",
          arguments: '{"location":',
        },
      },
    });

    // concatenate arguments to existing tool call
    store.getState().addRepetitionPartialToolCall(instanceId, 1, {
      id: "call_1",
      function: {
        name: "get_weather",
        arguments: ' "Paris"}',
      },
    });

    expect(store.getState().instances[0].repetitions[1]!.toolCalls).toEqual({
      call_1: {
        id: "call_1",
        function: {
          name: "get_weather",
          arguments: '{"location": "Paris"}',
        },
      },
    });

    // add a second tool call to ensure it doesn't clobber the first
    store.getState().addRepetitionPartialToolCall(instanceId, 1, {
      id: "call_2",
      function: {
        name: "get_temperature",
        arguments: '{"unit": "celsius"}',
      },
    });

    expect(store.getState().instances[0].repetitions[1]!.toolCalls).toEqual({
      call_1: {
        id: "call_1",
        function: {
          name: "get_weather",
          arguments: '{"location": "Paris"}',
        },
      },
      call_2: {
        id: "call_2",
        function: {
          name: "get_temperature",
          arguments: '{"unit": "celsius"}',
        },
      },
    });
  });
});

describe("setRepetitionToolCalls", () => {
  it("should set the tool calls for a repetition and replace existing tool calls if present", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().runPlaygroundInstances();
    const instanceId = store.getState().instances[0].id;

    // verify initial tool calls are empty
    expect(store.getState().instances[0].repetitions[1]!.toolCalls).toEqual({});

    // set tools calls
    store.getState().setRepetitionToolCalls(instanceId, 1, [
      {
        id: "call_1",
        function: {
          name: "get_time",
          arguments: '{"timezone": "UTC"}',
        },
      },
    ]);

    // verify tool calls are set
    expect(store.getState().instances[0].repetitions[1]!.toolCalls).toEqual({
      call_1: {
        id: "call_1",
        function: {
          name: "get_time",
          arguments: '{"timezone": "UTC"}',
        },
      },
    });

    // reset tools calls
    store.getState().setRepetitionToolCalls(instanceId, 1, [
      {
        id: "call_2",
        function: {
          name: "get_weather",
          arguments: '{"location": "Paris"}',
        },
      },
      {
        id: "call_3",
        function: {
          name: "get_temperature",
          arguments: '{"unit": "celsius"}',
        },
      },
    ]);

    // verify tool calls are replaced
    expect(store.getState().instances[0].repetitions[1]!.toolCalls).toEqual({
      call_2: {
        id: "call_2",
        function: {
          name: "get_weather",
          arguments: '{"location": "Paris"}',
        },
      },
      call_3: {
        id: "call_3",
        function: {
          name: "get_temperature",
          arguments: '{"unit": "celsius"}',
        },
      },
    });
  });
});

describe("clearRepetitions", () => {
  it("should clear repetitions for one instance without affecting other instances", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().addInstance();
    store.getState().setRepetitions(2);
    store.getState().runPlaygroundInstances();

    const firstInstanceId = store.getState().instances[0].id;
    const secondInstanceId = store.getState().instances[1].id;

    // add some output to both instances
    store.getState().appendRepetitionOutput(firstInstanceId, 1, "First output");
    store
      .getState()
      .appendRepetitionOutput(secondInstanceId, 1, "Second output");

    // verify both instances have repetitions
    expect(store.getState().instances[0].repetitions[1]!.output).toBe(
      "First output"
    );
    expect(store.getState().instances[0].repetitions[2]!.output).toBe(null);
    expect(store.getState().instances[1].repetitions[1]!.output).toBe(
      "Second output"
    );
    expect(store.getState().instances[1].repetitions[2]!.output).toBe(null);

    // clear repetitions for first instance only
    store.getState().clearRepetitions(firstInstanceId);

    // verify first instance repetitions are cleared
    expect(store.getState().instances[0].repetitions).toEqual({});

    // verify second instance repetitions are not affected
    expect(store.getState().instances[1].repetitions[1]!.output).toBe(
      "Second output"
    );
    expect(store.getState().instances[1].repetitions[2]!.output).toBe(null);
  });
});
