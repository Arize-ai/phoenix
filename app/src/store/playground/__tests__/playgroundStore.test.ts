import { InvocationParameter } from "@phoenix/components/playground/model/InvocationParametersFormFields";
import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import {
  RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
  RESPONSE_FORMAT_PARAM_NAME,
} from "@phoenix/pages/playground/constants";

import {
  _resetInstanceId,
  createNormalizedPlaygroundInstance,
  createOpenAIResponseFormat,
  createPlaygroundStore,
  DEFAULT_TEMPLATE_VARIABLES_PATH,
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
      datasetId: null,
      instances: [newInstance],
      modelConfigByProvider: {},
      datasetId: null,
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
      datasetId: null,
    };
    const { instances } = getInitialInstances(initialProps);

    expect(instances).toHaveLength(1);
    expect(instances[0].id).toBe(0);
    expect(instances[0].model.provider).toBe(DEFAULT_MODEL_PROVIDER);
    expect(instances[0].model.modelName).toBe(DEFAULT_MODEL_NAME);
  });

  it("should use saved model config if available", () => {
    const initialProps: InitialPlaygroundState = {
      datasetId: null,
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
      datasetId: null,
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
      datasetId: null,
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
      datasetId: null,
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
      datasetId: null,
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
      datasetId: null,
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
      datasetId: null,
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
      datasetId: null,
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
      datasetId: null,
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
      datasetId: null,
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
      datasetId: null,
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

describe("runPlaygroundInstances", () => {
  it("should create repetitions, set activeRunId, initialize status, and clear previous data", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().addInstance();

    // set to 3 repetitions
    store.getState().setRepetitions(3);

    // run instances for the first time
    store.getState().runPlaygroundInstances();

    // verify repetitions are created based on repetitions count (3)
    expect(Object.keys(store.getState().instances[0].repetitions)).toHaveLength(
      3
    );

    // verify all repetitions are initialized with pending status
    expect(
      Object.values(store.getState().instances[0].repetitions).every(
        (repetition) => repetition!.status === "pending"
      )
    ).toBe(true);

    // verify activeRunId is set for all instances
    const firstRunId = store.getState().instances[0].activeRunId;
    const secondRunId = store.getState().instances[1].activeRunId;
    expect(firstRunId).not.toBe(null);
    expect(secondRunId).not.toBe(null);
    expect(firstRunId).not.toBe(secondRunId);

    // add some data to first repetition
    store
      .getState()
      .appendRepetitionOutput(store.getState().instances[0].id, 1, "Output 1");
    store
      .getState()
      .setRepetitionSpanId(store.getState().instances[0].id, 1, "span-123");

    // verify data was added
    expect(store.getState().instances[0].repetitions[1]!.output).toBe(
      "Output 1"
    );
    expect(store.getState().instances[0].repetitions[1]!.spanId).toBe(
      "span-123"
    );

    // rerun instances
    store.getState().runPlaygroundInstances();

    // verify previous repetition data is cleared
    expect(
      Object.values(store.getState().instances[0].repetitions).every(
        (repetition) => repetition!.output === null
      )
    ).toBe(true);
    expect(
      Object.values(store.getState().instances[0].repetitions).every(
        (repetition) => repetition!.status === "pending"
      )
    ).toBe(true);

    // verify new run IDs were generated
    const newFirstRunId = store.getState().instances[0].activeRunId;
    const newSecondRunId = store.getState().instances[1].activeRunId;
    expect(newFirstRunId).not.toBe(null);
    expect(newSecondRunId).not.toBe(null);
    expect(newFirstRunId).not.toBe(firstRunId);
    expect(newSecondRunId).not.toBe(secondRunId);
  });
});

describe("markPlaygroundInstanceComplete", () => {
  it("should mark a specific instance as complete without affecting other instances", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().addInstance();
    store.getState().setRepetitions(2);

    // run both instances
    store.getState().runPlaygroundInstances();

    const [firstInstanceId, secondInstanceId] = store
      .getState()
      .instances.map((instance) => instance.id);

    // simulate progress on first instance
    store.getState().setRepetitionStatus(firstInstanceId, 1, "finished");
    store
      .getState()
      .appendRepetitionOutput(firstInstanceId, 1, "Complete output");
    store.getState().setRepetitionSpanId(firstInstanceId, 1, "span-123");
    store.getState().addRepetitionPartialToolCall(firstInstanceId, 1, {
      id: "call_1",
      function: {
        name: "get_weather",
        arguments: '{"location": "Paris"}',
      },
    });

    store
      .getState()
      .setRepetitionStatus(firstInstanceId, 2, "streamInProgress");
    store
      .getState()
      .appendRepetitionOutput(firstInstanceId, 2, "Partial output");

    // simulate progress on second instance
    store
      .getState()
      .setRepetitionStatus(secondInstanceId, 1, "streamInProgress");
    store
      .getState()
      .appendRepetitionOutput(secondInstanceId, 1, "Second instance output");

    // snapshot instances before marking complete
    const [firstInstanceBefore, secondInstanceBefore] =
      store.getState().instances;

    // mark first instance complete
    store.getState().markPlaygroundInstanceComplete(firstInstanceId);

    // get instances after
    const [firstInstanceAfter, secondInstanceAfter] =
      store.getState().instances;

    // verify first instance has expected changes
    expect(firstInstanceAfter).toEqual({
      ...firstInstanceBefore,
      activeRunId: null, // activeRunId should be cleared
      // all repetitions should be marked as finished
      repetitions: Object.fromEntries(
        Object.entries(firstInstanceBefore.repetitions).map(
          ([repetitionNumber, repetition]) => [
            repetitionNumber,
            {
              ...repetition,
              status: "finished",
            },
          ]
        )
      ),
    });

    // verify second instance is unchanged
    expect(secondInstanceAfter).toEqual(secondInstanceBefore);
  });
});

describe("cancelPlaygroundInstances", () => {
  it("should cancel all instances and set all repetitions to finished", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().addInstance();
    store.getState().setRepetitions(2);

    // run both instances
    store.getState().runPlaygroundInstances();

    const [firstInstanceId, secondInstanceId] = store
      .getState()
      .instances.map((instance) => instance.id);

    // simulate progress on first instance
    store.getState().setRepetitionStatus(firstInstanceId, 1, "finished");
    store
      .getState()
      .appendRepetitionOutput(firstInstanceId, 1, "Complete output");
    store.getState().setRepetitionSpanId(firstInstanceId, 1, "span-123");

    store
      .getState()
      .setRepetitionStatus(firstInstanceId, 2, "streamInProgress");
    store
      .getState()
      .appendRepetitionOutput(firstInstanceId, 2, "Partial output");

    // simulate progress on second instance
    store
      .getState()
      .setRepetitionStatus(secondInstanceId, 1, "streamInProgress");
    store
      .getState()
      .appendRepetitionOutput(secondInstanceId, 1, "Second instance output");

    // snapshot instances before canceling
    const [firstInstanceBefore, secondInstanceBefore] =
      store.getState().instances;

    // cancel all instances
    store.getState().cancelPlaygroundInstances();

    // get instances after
    const [firstInstanceAfter, secondInstanceAfter] =
      store.getState().instances;

    // verify instances have expected changes
    expect(firstInstanceAfter).toEqual({
      ...firstInstanceBefore,
      activeRunId: null,
      repetitions: Object.fromEntries(
        Object.entries(firstInstanceBefore.repetitions).map(
          ([repetitionNumber, repetition]) => [
            repetitionNumber,
            { ...repetition, status: "finished" },
          ]
        )
      ),
    });
    expect(secondInstanceAfter).toEqual({
      ...secondInstanceBefore,
      activeRunId: null,
      repetitions: Object.fromEntries(
        Object.entries(secondInstanceBefore.repetitions).map(
          ([repetitionNumber, repetition]) => [
            repetitionNumber,
            { ...repetition, status: "finished" },
          ]
        )
      ),
    });
  });
});

describe("updateModelSupportedInvocationParameters", () => {
  it("should preserve response format when updating supported invocation parameters", () => {
    // This test captures the bug where response format disappears when
    // the model changes (e.g., GPT-4o to GPT-4.1) because it's not marked as dirty.
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);
    const instanceId = store.getState().instances[0].id;

    // Add a response format via upsertInvocationParameterInput
    // Note: This mimics how the UI adds response format - WITHOUT dirty: true
    const responseFormatValue = createOpenAIResponseFormat();
    store.getState().upsertInvocationParameterInput({
      instanceId,
      invocationParameterInput: {
        invocationName: RESPONSE_FORMAT_PARAM_NAME,
        canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
        valueJson: responseFormatValue,
      },
    });

    // Verify response format was added
    let responseFormat = store
      .getState()
      .instances[0].model.invocationParameters.find(
        (p) =>
          p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME ||
          p.invocationName === RESPONSE_FORMAT_PARAM_NAME
      );
    expect(responseFormat).toBeDefined();
    expect(responseFormat?.valueJson).toEqual(responseFormatValue);

    // Create some mock supported invocation parameters that include response format
    const supportedInvocationParameters: InvocationParameter[] = [
      {
        __typename: "FloatInvocationParameter",
        invocationName: "temperature",
        canonicalName: "TEMPERATURE",
        required: false,
        floatDefaultValue: 1.0,
        invocationInputField: "value_float",
      },
      {
        __typename: "JSONInvocationParameter",
        invocationName: RESPONSE_FORMAT_PARAM_NAME,
        canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
        required: false,
        invocationInputField: "value_json",
      },
    ];

    // Simulate what happens when ModelSupportedParamsFetcher triggers after a model change
    store.getState().updateModelSupportedInvocationParameters({
      instanceId,
      supportedInvocationParameters,
      modelConfigByProvider: {},
    });

    // Assert response format is still present after the update
    responseFormat = store
      .getState()
      .instances[0].model.invocationParameters.find(
        (p) =>
          p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME ||
          p.invocationName === RESPONSE_FORMAT_PARAM_NAME
      );
    expect(responseFormat).toBeDefined();
    expect(responseFormat?.valueJson).toEqual(responseFormatValue);
  });

  it("should preserve response format when copied via addInstance (Compare feature)", () => {
    // This test captures the bug where response format disappears when
    // clicking "Compare" because the new instance triggers updateModelSupportedInvocationParameters.
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);
    const firstInstanceId = store.getState().instances[0].id;

    // Add a response format to the first instance
    const responseFormatValue = createOpenAIResponseFormat();
    store.getState().upsertInvocationParameterInput({
      instanceId: firstInstanceId,
      invocationParameterInput: {
        invocationName: RESPONSE_FORMAT_PARAM_NAME,
        canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
        valueJson: responseFormatValue,
      },
    });

    // Add a second instance (simulates clicking "Compare")
    store.getState().addInstance();
    const secondInstanceId = store.getState().instances[1].id;

    // Verify the response format was copied to the second instance
    let responseFormat = store
      .getState()
      .instances[1].model.invocationParameters.find(
        (p) =>
          p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME ||
          p.invocationName === RESPONSE_FORMAT_PARAM_NAME
      );
    expect(responseFormat).toBeDefined();
    expect(responseFormat?.valueJson).toEqual(responseFormatValue);

    // Simulate what happens when ModelSupportedParamsFetcher triggers for the new instance
    const supportedInvocationParameters: InvocationParameter[] = [
      {
        __typename: "FloatInvocationParameter",
        invocationName: "temperature",
        canonicalName: "TEMPERATURE",
        required: false,
        floatDefaultValue: 1.0,
        invocationInputField: "value_float",
      },
      {
        __typename: "JSONInvocationParameter",
        invocationName: RESPONSE_FORMAT_PARAM_NAME,
        canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
        required: false,
        invocationInputField: "value_json",
      },
    ];

    store.getState().updateModelSupportedInvocationParameters({
      instanceId: secondInstanceId,
      supportedInvocationParameters,
      modelConfigByProvider: {},
    });

    // Assert response format is still present after the update
    responseFormat = store
      .getState()
      .instances[1].model.invocationParameters.find(
        (p) =>
          p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME ||
          p.invocationName === RESPONSE_FORMAT_PARAM_NAME
      );
    expect(responseFormat).toBeDefined();
    expect(responseFormat?.valueJson).toEqual(responseFormatValue);
  });

  it("should not create duplicate response format when dirty: true is set", () => {
    // This test verifies that when response format has dirty: true (set when users
    // modify it via the form), it doesn't get duplicated in the final parameters.
    // The dirty parameter flows through mergedInvocationParameters, and then the
    // code should NOT append it again.
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);
    const instanceId = store.getState().instances[0].id;

    // Add a response format WITH dirty: true (as if user modified it via form)
    const responseFormatValue = createOpenAIResponseFormat();
    store.getState().upsertInvocationParameterInput({
      instanceId,
      invocationParameterInput: {
        invocationName: RESPONSE_FORMAT_PARAM_NAME,
        canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
        valueJson: responseFormatValue,
        dirty: true, // User modified via form
      },
    });

    // Verify response format was added
    let params = store.getState().instances[0].model.invocationParameters;
    let responseFormats = params.filter(
      (p) =>
        p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME ||
        p.invocationName === RESPONSE_FORMAT_PARAM_NAME
    );
    expect(responseFormats).toHaveLength(1);

    // Create supported invocation parameters that include response format
    const supportedInvocationParameters: InvocationParameter[] = [
      {
        __typename: "FloatInvocationParameter",
        invocationName: "temperature",
        canonicalName: "TEMPERATURE",
        required: false,
        floatDefaultValue: 1.0,
        invocationInputField: "value_float",
      },
      {
        __typename: "JSONInvocationParameter",
        invocationName: RESPONSE_FORMAT_PARAM_NAME,
        canonicalName: RESPONSE_FORMAT_PARAM_CANONICAL_NAME,
        required: false,
        invocationInputField: "value_json",
      },
    ];

    // Simulate what happens when ModelSupportedParamsFetcher triggers after a model change
    store.getState().updateModelSupportedInvocationParameters({
      instanceId,
      supportedInvocationParameters,
      modelConfigByProvider: {},
    });

    // Assert there is exactly ONE response format parameter (no duplicates)
    params = store.getState().instances[0].model.invocationParameters;
    responseFormats = params.filter(
      (p) =>
        p.canonicalName === RESPONSE_FORMAT_PARAM_CANONICAL_NAME ||
        p.invocationName === RESPONSE_FORMAT_PARAM_NAME
    );
    expect(responseFormats).toHaveLength(1);
    expect(responseFormats[0]?.valueJson).toEqual(responseFormatValue);
  });
});

describe("dataset-scoped state", () => {
  beforeEach(() => {
    _resetInstanceId();
  });

  it("should initialize templateVariablesPath when store is created with a dataset ID", () => {
    const datasetId = "test-dataset-123";
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId,
    };
    const store = createPlaygroundStore(initialProps);

    // verify the dataset ID is set
    expect(store.getState().datasetId).toBe(datasetId);

    // verify templateVariablesPath is initialized to the default value
    expect(store.getState().stateByDatasetId[datasetId]).toEqual({
      templateVariablesPath: DEFAULT_TEMPLATE_VARIABLES_PATH,
    });
  });

  it("should initialize templateVariablesPath when dataset ID is changed to a new value", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);

    // verify initial state has no dataset
    expect(store.getState().datasetId).toBe(null);
    expect(store.getState().stateByDatasetId).toEqual({});

    // change to a new dataset
    const newDatasetId = "new-dataset-456";
    store.getState().setDatasetId(newDatasetId);

    // verify the dataset ID is updated
    expect(store.getState().datasetId).toBe(newDatasetId);

    // verify templateVariablesPath is initialized to the default value for the new dataset
    expect(store.getState().stateByDatasetId[newDatasetId]).toEqual({
      templateVariablesPath: DEFAULT_TEMPLATE_VARIABLES_PATH,
    });
  });

  it("should not re-initialize when switching back to a previously visited dataset", () => {
    const datasetId1 = "dataset-1";
    const datasetId2 = "dataset-2";
    const customPath = "custom.path";

    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: datasetId1,
    };
    const store = createPlaygroundStore(initialProps);

    // set a custom template variables path for dataset 1
    store.getState().setTemplateVariablesPath({
      templateVariablesPath: customPath,
      datasetId: datasetId1,
    });

    // verify the custom path is set
    expect(
      store.getState().stateByDatasetId[datasetId1].templateVariablesPath
    ).toBe(customPath);

    // switch to dataset 2
    store.getState().setDatasetId(datasetId2);
    expect(store.getState().datasetId).toBe(datasetId2);
    expect(store.getState().stateByDatasetId[datasetId2]).toEqual({
      templateVariablesPath: DEFAULT_TEMPLATE_VARIABLES_PATH,
    });

    // switch back to dataset 1
    store.getState().setDatasetId(datasetId1);
    expect(store.getState().datasetId).toBe(datasetId1);

    // verify the custom path is still preserved
    expect(
      store.getState().stateByDatasetId[datasetId1].templateVariablesPath
    ).toBe(customPath);
  });
});
