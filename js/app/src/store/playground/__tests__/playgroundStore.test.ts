import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import { getDefaultInvocationConfig } from "@phoenix/pages/playground/providerAdapters";

import {
  _resetInstanceId,
  createNormalizedPlaygroundInstance,
  createPlaygroundStore,
  DEFAULT_MAX_CONCURRENCY,
  getInitialInstances,
} from "../playgroundStore";
import {
  DEFAULT_TEMPLATE_VARIABLES_PATH,
  DEFAULT_TEMPLATE_VARIABLES_PATH_BY_TASK_KIND,
  getTemplateVariablesPath,
} from "../templateVariablesPath";
import {
  type CanonicalResponseFormat,
  type InitialPlaygroundState,
  type PlaygroundNormalizedInstance,
  PlaygroundStateByDatasetIdSchema,
} from "../types";

/** The message ids of a chat template; every instance the store builds is one. */
function chatMessageIds(
  template: PlaygroundNormalizedInstance["template"]
): number[] {
  if (template.__type !== "chat") {
    throw new Error("expected a chat template");
  }

  return template.messageIds;
}

installTestStorage();

const TEST_RESPONSE_FORMAT: CanonicalResponseFormat = {
  type: "json_schema",
  jsonSchema: { name: "MySchema", schema: { type: "object" }, strict: true },
};

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
        invocationParameters: getDefaultInvocationConfig("OPENAI"),
      },
    };

    // simulated props that would be passed to the PlaygroundProvider
    const initialProps: InitialPlaygroundState = {
      datasetId: null,
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
          invocationParameters: getDefaultInvocationConfig("OPENAI"),
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
          invocationParameters: getDefaultInvocationConfig("OPENAI"),
        },
        ANTHROPIC: {
          modelName: "test-model-anthropic",
          provider: "ANTHROPIC",
          invocationParameters: getDefaultInvocationConfig("ANTHROPIC"),
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
          invocationParameters: getDefaultInvocationConfig("ANTHROPIC"),
        },
      },
    };

    const { instances } = getInitialInstances(initialProps);

    expect(instances).toHaveLength(1);
    expect(instances[0].model.provider).toBe("ANTHROPIC");
    expect(instances[0].model.modelName).toBe("test-model-anthropic");
  });

  it("should use the user's preferred default provider and model when no saved configs exist", () => {
    const initialProps: InitialPlaygroundState = {
      datasetId: null,
      modelConfigByProvider: {},
      defaultModelProvider: "AWS",
      defaultModelName: "anthropic.claude-sonnet-4-5-20250929-v1:0",
    };

    const { instances } = getInitialInstances(initialProps);

    expect(instances).toHaveLength(1);
    expect(instances[0].model.provider).toBe("AWS");
    expect(instances[0].model.modelName).toBe(
      "anthropic.claude-sonnet-4-5-20250929-v1:0"
    );
  });

  it("should prefer the user's default provider when picking among saved configs", () => {
    const initialProps: InitialPlaygroundState = {
      datasetId: null,
      modelConfigByProvider: {
        OPENAI: {
          modelName: "test-model-openai",
          provider: "OPENAI",
          invocationParameters: getDefaultInvocationConfig("OPENAI"),
        },
        ANTHROPIC: {
          modelName: "test-model-anthropic",
          provider: "ANTHROPIC",
          invocationParameters: getDefaultInvocationConfig("ANTHROPIC"),
        },
      },
      defaultModelProvider: "ANTHROPIC",
      defaultModelName: "claude-3-5-sonnet-latest",
    };

    const { instances } = getInitialInstances(initialProps);

    expect(instances).toHaveLength(1);
    // The saved config for the preferred provider wins over the bare model name
    // pref so that previously chosen invocation params are preserved.
    expect(instances[0].model.provider).toBe("ANTHROPIC");
    expect(instances[0].model.modelName).toBe("test-model-anthropic");
  });

  it("should keep the user's preference when no saved config exists for the preferred provider", () => {
    const initialProps: InitialPlaygroundState = {
      datasetId: null,
      modelConfigByProvider: {
        OPENAI: {
          modelName: "test-model-openai",
          provider: "OPENAI",
          invocationParameters: getDefaultInvocationConfig("OPENAI"),
        },
      },
      defaultModelProvider: "AWS",
      defaultModelName: "anthropic.claude-sonnet-4-5-20250929-v1:0",
    };

    const { instances } = getInitialInstances(initialProps);

    expect(instances).toHaveLength(1);
    // The user's explicit preference for AWS should win over an unrelated
    // saved config for a different provider.
    expect(instances[0].model.provider).toBe("AWS");
    expect(instances[0].model.modelName).toBe(
      "anthropic.claude-sonnet-4-5-20250929-v1:0"
    );
  });
});

describe("setSelectedRepetitionNumber", () => {
  it("should set selected repetition number for an instance", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().addInstance({ type: "duplicate" });
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

describe("setRepetitionTraceId", () => {
  it("should set repetition trace id", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);
    store.getState().runPlaygroundInstances();
    const instanceId = store.getState().instances[0].id;

    expect(store.getState().instances[0].repetitions[1]!.traceId).toBe(
      undefined
    );

    store.getState().setRepetitionTraceId(instanceId, 1, "trace-abc-123");
    expect(store.getState().instances[0].repetitions[1]!.traceId).toBe(
      "trace-abc-123"
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
    store.getState().addInstance({ type: "duplicate" });
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
    store.getState().addInstance({ type: "duplicate" });

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
    store.getState().addInstance({ type: "duplicate" });
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
    store.getState().addInstance({ type: "duplicate" });
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
  it("stores canonical Anthropic config after individual row edits", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });
    const instanceId = store.getState().instances[0].id;

    store.getState().updateProvider({
      instanceId,
      provider: "ANTHROPIC",
      modelConfigByProvider: {},
    });
    store.getState().setInvocationParameterField({
      instanceId,
      fieldName: "temperature",
      value: 0.7,
    });
    store.getState().setInvocationParameterField({
      instanceId,
      fieldName: "topP",
      value: 0.9,
    });
    store.getState().setInvocationParameterField({
      instanceId,
      fieldName: "thinkingType",
      value: "enabled",
    });
    store.getState().setInvocationParameterField({
      instanceId,
      fieldName: "thinkingBudgetTokens",
      value: 1024,
    });

    expect(store.getState().instances[0].model.invocationParameters).toEqual({
      maxTokens: 2000,
      thinking: {
        type: "enabled",
        budgetTokens: 1024,
        display: "SUMMARIZED",
      },
      effort: "HIGH",
    });
  });

  it("normalizes bulk invocation-config updates before storing", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });
    const instanceId = store.getState().instances[0].id;

    store.getState().updateProvider({
      instanceId,
      provider: "ANTHROPIC",
      modelConfigByProvider: {},
    });
    // Setting thinkingType=adaptive should make normalize strip temperature
    // (Anthropic rejects temp/top_p while extended thinking is active).
    store.getState().setInvocationParameterField({
      instanceId,
      fieldName: "temperature",
      value: 0.7,
    });
    store.getState().setInvocationParameterField({
      instanceId,
      fieldName: "thinkingType",
      value: "adaptive",
    });

    expect(store.getState().instances[0].model.invocationParameters).toEqual({
      maxTokens: 2000,
      thinking: { type: "adaptive", display: "SUMMARIZED" },
      effort: "HIGH",
    });
  });

  it("switches providers through the new provider's canonical config", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });
    const instanceId = store.getState().instances[0].id;

    // Set some OpenAI-shape values; switching to Anthropic drops them because
    // we no longer carry values across providers (provider configs are
    // different shapes; new provider starts from defaults).
    store.getState().setInvocationParameterField({
      instanceId,
      fieldName: "frequencyPenalty",
      value: 0.4,
    });
    store.getState().setInvocationParameterField({
      instanceId,
      fieldName: "temperature",
      value: 0.3,
    });
    store.getState().updateProvider({
      instanceId,
      provider: "ANTHROPIC",
      modelConfigByProvider: {},
    });

    // Anthropic defaults from getDefaultInvocationConfig.
    expect(store.getState().instances[0].model.invocationParameters).toEqual({
      maxTokens: 2000,
      thinking: { type: "adaptive", display: "SUMMARIZED" },
      effort: "HIGH",
    });
  });

  it("preserves saved provider config exactly when switching providers", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });
    const instanceId = store.getState().instances[0].id;

    store.getState().updateProvider({
      instanceId,
      provider: "ANTHROPIC",
      modelConfigByProvider: {
        ANTHROPIC: {
          provider: "ANTHROPIC",
          modelName: "claude-sonnet-4-5",
          invocationParameters: { maxTokens: 3000 },
        },
      },
    });

    expect(store.getState().instances[0].model.invocationParameters).toEqual({
      maxTokens: 3000,
    });
  });

  it("syncs connection metadata without changing canonical invocation config", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });
    const instanceId = store.getState().instances[0].id;

    store.getState().updateProvider({
      instanceId,
      provider: "ANTHROPIC",
      modelConfigByProvider: {},
    });
    store.getState().setInvocationParameterField({
      instanceId,
      fieldName: "thinkingType",
      value: "enabled",
    });
    store.getState().setInvocationParameterField({
      instanceId,
      fieldName: "thinkingBudgetTokens",
      value: 1024,
    });
    store.getState().syncInvocationParametersWithSpecs({
      instanceId,
      modelConfigByProvider: {},
    });

    expect(store.getState().instances[0].model.invocationParameters).toEqual({
      maxTokens: 2000,
      thinking: {
        type: "enabled",
        budgetTokens: 1024,
        display: "SUMMARIZED",
      },
      effort: "HIGH",
    });
  });

  it("should preserve response format when updating supported invocation parameters", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);
    const instanceId = store.getState().instances[0].id;

    store.getState().setResponseFormat({
      instanceId,
      responseFormat: TEST_RESPONSE_FORMAT,
    });

    expect(store.getState().instances[0].model.responseFormat).toEqual(
      TEST_RESPONSE_FORMAT
    );

    store.getState().syncInvocationParametersWithSpecs({
      instanceId,
      modelConfigByProvider: {},
    });

    expect(store.getState().instances[0].model.responseFormat).toEqual(
      TEST_RESPONSE_FORMAT
    );
  });

  it("should preserve response format when copied via addInstance (Compare feature)", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);
    const firstInstanceId = store.getState().instances[0].id;

    store.getState().setResponseFormat({
      instanceId: firstInstanceId,
      responseFormat: TEST_RESPONSE_FORMAT,
    });

    store.getState().addInstance({ type: "duplicate" });
    const secondInstanceId = store.getState().instances[1].id;

    // Verify the response format was copied to the second instance via spread
    expect(store.getState().instances[1].model.responseFormat).toEqual(
      TEST_RESPONSE_FORMAT
    );

    store.getState().syncInvocationParametersWithSpecs({
      instanceId: secondInstanceId,
      modelConfigByProvider: {},
    });

    expect(store.getState().instances[1].model.responseFormat).toEqual(
      TEST_RESPONSE_FORMAT
    );
  });

  it("should clear response format when deleteResponseFormat is called", () => {
    const initialProps: InitialPlaygroundState = {
      modelConfigByProvider: {},
      datasetId: null,
    };
    const store = createPlaygroundStore(initialProps);
    const instanceId = store.getState().instances[0].id;

    store.getState().setResponseFormat({
      instanceId,
      responseFormat: TEST_RESPONSE_FORMAT,
    });

    expect(store.getState().instances[0].model.responseFormat).toEqual(
      TEST_RESPONSE_FORMAT
    );

    store.getState().deleteResponseFormat({ instanceId });

    expect(store.getState().instances[0].model.responseFormat).toBeUndefined();
  });
});

describe("setVariableValues", () => {
  it("should set multiple variable values without clearing existing values", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });

    store.getState().setVariableValue("question", "old question");
    store.getState().setVariableValues([
      { key: "question", value: "new question" },
      { key: "answer", value: "new answer" },
    ]);

    expect(store.getState().input.variablesValueCache).toEqual({
      question: "new question",
      answer: "new answer",
    });
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
      templateVariablesPathByTaskKind:
        DEFAULT_TEMPLATE_VARIABLES_PATH_BY_TASK_KIND,
      maxConcurrency: DEFAULT_MAX_CONCURRENCY,
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
      templateVariablesPathByTaskKind:
        DEFAULT_TEMPLATE_VARIABLES_PATH_BY_TASK_KIND,
      maxConcurrency: DEFAULT_MAX_CONCURRENCY,
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
      taskKind: "prompt",
    });

    // verify the custom path is set
    expect(
      store.getState().stateByDatasetId[datasetId1]
        .templateVariablesPathByTaskKind.prompt
    ).toBe(customPath);

    // switch to dataset 2
    store.getState().setDatasetId(datasetId2);
    expect(store.getState().datasetId).toBe(datasetId2);
    expect(store.getState().stateByDatasetId[datasetId2]).toEqual({
      templateVariablesPathByTaskKind:
        DEFAULT_TEMPLATE_VARIABLES_PATH_BY_TASK_KIND,
      maxConcurrency: DEFAULT_MAX_CONCURRENCY,
    });

    // switch back to dataset 1
    store.getState().setDatasetId(datasetId1);
    expect(store.getState().datasetId).toBe(datasetId1);

    // verify the custom path is still preserved
    expect(
      store.getState().stateByDatasetId[datasetId1]
        .templateVariablesPathByTaskKind.prompt
    ).toBe(customPath);
  });

  it("keeps a template variables path per kind of task", () => {
    const datasetId = "dataset-1";
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId,
    });

    store.getState().setTemplateVariablesPath({
      templateVariablesPath: "output",
      datasetId,
      taskKind: "evaluator",
    });

    const { stateByDatasetId } = store.getState();
    expect(stateByDatasetId[datasetId].templateVariablesPathByTaskKind).toEqual(
      { prompt: DEFAULT_TEMPLATE_VARIABLES_PATH, evaluator: "output" }
    );
    expect(
      getTemplateVariablesPath({
        stateByDatasetId,
        datasetId,
        taskKind: "prompt",
      })
    ).toBe("input");
    expect(
      getTemplateVariablesPath({
        stateByDatasetId,
        datasetId,
        taskKind: "evaluator",
      })
    ).toBe("output");
  });

  it("starts prompt tasks at input and evaluator tasks at the example root", () => {
    const datasetId = "dataset-1";
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId,
    });
    const { stateByDatasetId } = store.getState();

    expect(
      getTemplateVariablesPath({
        stateByDatasetId,
        datasetId,
        taskKind: "prompt",
      })
    ).toBe("input");
    expect(
      getTemplateVariablesPath({
        stateByDatasetId,
        datasetId,
        taskKind: "evaluator",
      })
    ).toBeNull();
    // A dataset without state yet reads the same defaults.
    expect(
      getTemplateVariablesPath({
        stateByDatasetId,
        datasetId: "unseen",
        taskKind: "prompt",
      })
    ).toBe("input");
    expect(
      getTemplateVariablesPath({
        stateByDatasetId,
        datasetId: "unseen",
        taskKind: "evaluator",
      })
    ).toBeNull();
  });

  it("keeps an explicit example-root choice for prompt tasks", () => {
    const datasetId = "dataset-1";
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId,
    });

    store.getState().setTemplateVariablesPath({
      templateVariablesPath: null,
      datasetId,
      taskKind: "prompt",
    });

    expect(
      getTemplateVariablesPath({
        stateByDatasetId: store.getState().stateByDatasetId,
        datasetId,
        taskKind: "prompt",
      })
    ).toBeNull();
  });

  it("creates a dataset's state with defaults when a setting lands first", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });

    store
      .getState()
      .setAppendedMessagesPath({ path: "messages", datasetId: "dataset-1" });

    expect(store.getState().stateByDatasetId["dataset-1"]).toEqual({
      appendedMessagesPath: "messages",
      templateVariablesPathByTaskKind:
        DEFAULT_TEMPLATE_VARIABLES_PATH_BY_TASK_KIND,
      maxConcurrency: DEFAULT_MAX_CONCURRENCY,
    });
  });

  it("migrates persisted state that held one template variables path", () => {
    expect(
      PlaygroundStateByDatasetIdSchema.parse({
        custom: { templateVariablesPath: "payload.inputs", maxConcurrency: 4 },
        root: { templateVariablesPath: null, maxConcurrency: 10 },
        unset: { maxConcurrency: 10 },
        current: {
          templateVariablesPathByTaskKind: {
            prompt: "input",
            evaluator: "output",
          },
          maxConcurrency: 2,
        },
      })
    ).toEqual({
      custom: {
        templateVariablesPathByTaskKind: {
          prompt: "payload.inputs",
          evaluator: null,
        },
        maxConcurrency: 4,
      },
      root: {
        templateVariablesPathByTaskKind: { prompt: null, evaluator: null },
        maxConcurrency: 10,
      },
      unset: {
        templateVariablesPathByTaskKind: { prompt: "input", evaluator: null },
        maxConcurrency: 10,
      },
      current: {
        templateVariablesPathByTaskKind: {
          prompt: "input",
          evaluator: "output",
        },
        maxConcurrency: 2,
      },
    });
  });
});

describe("addInstance", () => {
  const createStore = () =>
    createPlaygroundStore({ modelConfigByProvider: {}, datasetId: null });

  it("duplicates the first instance with fresh message ids", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });

    const [first] = store.getState().instances;
    const id = store.getState().addInstance({ type: "duplicate" });
    const second = store.getState().instances[1];

    expect(id).toBe(second.id);
    expect(second.task).toEqual({ kind: "prompt" });
    expect(second.model).toEqual(first.model);
    expect(second.template).not.toEqual(first.template);
    expect(
      chatMessageIds(second.template).map(
        (messageId) => store.getState().allInstanceMessages[messageId].content
      )
    ).toEqual(
      chatMessageIds(first.template).map(
        (messageId) => store.getState().allInstanceMessages[messageId].content
      )
    );
  });

  it("adds a new prompt task on the page's model without a loading source", () => {
    const store = createStore();
    store.getState().updateProvider({
      instanceId: store.getState().instances[0].id,
      provider: "ANTHROPIC",
      modelConfigByProvider: {},
    });
    store.getState().addInstance({ type: "new", kind: "prompt" });
    const second = store.getState().instances[1];

    expect(second.task).toEqual({ kind: "prompt" });
    expect(second.prompt).toBeUndefined();
    expect(second.loadingSource).toBeUndefined();
    expect(second.model.provider).toBe("ANTHROPIC");
  });

  it("adds a new LLM evaluator draft with the judge prompt as its template", () => {
    const store = createStore();
    store.getState().addInstance({ type: "new", kind: "LLM" });
    const second = store.getState().instances[1];

    expect(second.task.kind).toBe("evaluator");
    expect(
      second.task.kind === "evaluator" && second.task.evaluator
    ).toMatchObject({ kind: "LLM", code: null });
    expect(second.toolChoice).toEqual({ type: "ONE_OR_MORE" });
    const messageIds = chatMessageIds(second.template);
    expect(messageIds).toHaveLength(2);
    expect(store.getState().allInstanceMessages[messageIds[0]].role).toBe(
      "system"
    );
  });

  it("adds a new code evaluator draft with an empty template and placeholder code", () => {
    const store = createStore();
    store.getState().addInstance({ type: "new", kind: "CODE" });
    const second = store.getState().instances[1];

    expect(
      second.task.kind === "evaluator" && second.task.evaluator.code
    ).toMatchObject({ language: "PYTHON", sandboxConfigId: null });
    expect(chatMessageIds(second.template)).toEqual([]);
  });

  it("marks a saved prompt source as loading until its content lands", () => {
    const store = createStore();

    const source = {
      type: "prompt" as const,
      promptId: "P1",
      promptVersionId: "V1",
      tagName: null,
    };

    store.getState().addInstance(source);
    const second = store.getState().instances[1];

    expect(second.task).toEqual({ kind: "prompt" });
    expect(second.loadingSource).toEqual(source);
    expect(second.prompt).toBeUndefined();
  });

  it("marks a saved evaluator source as loading and records it on the task", () => {
    const store = createStore();
    store.getState().addInstance({ type: "evaluator", evaluatorId: "E1" });
    store
      .getState()
      .addInstance({ type: "datasetEvaluator", datasetEvaluatorId: "DE1" });
    const [, second, third] = store.getState().instances;

    expect(second.loadingSource).toEqual({
      type: "evaluator",
      evaluatorId: "E1",
    });
    expect(
      second.task.kind === "evaluator" && second.task.evaluator.source
    ).toEqual({ evaluatorId: "E1", datasetEvaluatorId: null });
    expect(
      third.task.kind === "evaluator" && third.task.evaluator.source
    ).toEqual({ evaluatorId: null, datasetEvaluatorId: "DE1" });
  });
});

describe("replaceInstance", () => {
  it("swaps the instance in place with a fresh id and clears its dirty flag", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });

    store.getState().addInstance({ type: "duplicate" });
    const [first, second] = store.getState().instances;
    store.getState().setDirty(first.id, true);

    const replacementId = store.getState().replaceInstance({
      instanceId: first.id,
      source: { type: "new", kind: "CODE" },
    });

    const instances = store.getState().instances;
    expect(instances).toHaveLength(2);
    expect(instances[0].id).toBe(replacementId);
    expect(instances[0].id).not.toBe(first.id);
    expect(instances[0].task.kind).toBe("evaluator");
    expect(instances[1]).toBe(second);
    expect(store.getState().dirtyInstances[first.id]).toBe(false);
    expect(store.getState().dirtyInstances[instances[0].id]).toBe(false);
  });

  it("returns null for an unknown instance", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });

    expect(
      store
        .getState()
        .replaceInstance({ instanceId: 999, source: { type: "duplicate" } })
    ).toBeNull();
    expect(store.getState().instances).toHaveLength(1);
  });
});

describe("loadInstance", () => {
  it("lands fetched content under the same id, normalizing its messages", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });

    const instanceId = store.getState().addInstance({
      type: "prompt",
      promptId: "P1",
    });

    if (instanceId == null) throw new Error("expected an instance");
    store.getState().setDirty(instanceId, true);

    const { instance: defaults } = createNormalizedPlaygroundInstance();
    store.getState().loadInstance({
      instanceId,
      instance: {
        ...defaults,
        template: {
          __type: "chat",
          messages: [{ id: 501, role: "user", content: "{{output}}" }],
        },
        prompt: { id: "P1", name: "judge", version: "V1", tag: null },
      },
    });

    const loaded = store.getState().instances[1];
    expect(loaded.id).toBe(instanceId);
    expect(loaded.loadingSource).toBeNull();
    expect(loaded.prompt).toEqual({
      id: "P1",
      name: "judge",
      version: "V1",
      tag: null,
    });
    expect(loaded.template).toEqual({ __type: "chat", messageIds: [501] });
    expect(store.getState().allInstanceMessages[501].content).toBe(
      "{{output}}"
    );
    expect(store.getState().dirtyInstances[instanceId]).toBe(false);
  });
});

describe("runPlaygroundInstances with instanceIds", () => {
  it("starts a run only on the named instances", () => {
    const store = createPlaygroundStore({
      modelConfigByProvider: {},
      datasetId: null,
    });

    store.getState().addInstance({ type: "duplicate" });
    const [first, second] = store.getState().instances;

    store.getState().runPlaygroundInstances([second.id]);

    const [firstAfter, secondAfter] = store.getState().instances;
    expect(firstAfter.activeRunId).toBeNull();
    expect(firstAfter).toBe(first);
    expect(secondAfter.activeRunId).not.toBeNull();
    expect(secondAfter.repetitions[1]?.status).toBe("pending");
  });
});
