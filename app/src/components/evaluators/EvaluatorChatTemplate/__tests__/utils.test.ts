import {
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "@phoenix/constants/generativeConstants";
import {
  getDefaultInvocationConfig,
  parseInvocationConfig,
} from "@phoenix/pages/playground/providerAdapters";
import type { ModelConfigByProvider } from "@phoenix/store/preferencesStore";

import { makeLLMEvaluatorInstance } from "../utils";

describe("makeLLMEvaluatorInstance", () => {
  it("uses default provider/model and default invocation config when no saved config exists", () => {
    const instance = makeLLMEvaluatorInstance({
      modelConfigByProvider: {},
    })![0];
    expect(instance.model.provider).toBe(DEFAULT_MODEL_PROVIDER);
    expect(instance.model.modelName).toBe(DEFAULT_MODEL_NAME);
    expect(instance.model.invocationParameters).toEqual(
      getDefaultInvocationConfig(DEFAULT_MODEL_PROVIDER)
    );
  });

  it("falls back to default invocation config when the saved config has no invocation parameters", () => {
    const modelConfigByProvider: ModelConfigByProvider = {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- intentionally omits the required invocationParameters to exercise the fallback path
      [DEFAULT_MODEL_PROVIDER]: {
        provider: DEFAULT_MODEL_PROVIDER,
        modelName: "gpt-4o-mini",
        // invocationParameters intentionally omitted
      } as ModelConfigByProvider[typeof DEFAULT_MODEL_PROVIDER],
    };
    const instance = makeLLMEvaluatorInstance({ modelConfigByProvider })![0];
    expect(instance.model.modelName).toBe("gpt-4o-mini");
    expect(instance.model.invocationParameters).toEqual(
      getDefaultInvocationConfig(DEFAULT_MODEL_PROVIDER)
    );
  });

  it("parses saved invocation parameters through the provider adapter", () => {
    const savedInvocationParameters = { temperature: 0.42 };
    const modelConfigByProvider: ModelConfigByProvider = {
      [DEFAULT_MODEL_PROVIDER]: {
        provider: DEFAULT_MODEL_PROVIDER,
        modelName: "gpt-4o-mini",
        invocationParameters: savedInvocationParameters,
      } as ModelConfigByProvider[typeof DEFAULT_MODEL_PROVIDER],
    };
    const instance = makeLLMEvaluatorInstance({ modelConfigByProvider })![0];
    expect(instance.model.invocationParameters).toEqual(
      parseInvocationConfig(DEFAULT_MODEL_PROVIDER, savedInvocationParameters)
    );
    // Sanity: the saved value actually round-tripped rather than being dropped.
    expect(instance.model.invocationParameters).toMatchObject({
      temperature: 0.42,
    });
  });
});
