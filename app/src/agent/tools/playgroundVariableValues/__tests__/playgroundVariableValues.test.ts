import { createSetVariableValuesClientAction } from "@phoenix/agent/tools/playgroundVariableValues";
import { createPlaygroundStore } from "@phoenix/store/playground";

describe("playground variable values agent tool", () => {
  it("sets playground variable values", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().setVariableValue("question", "old question");
    const action = createSetVariableValuesClientAction({ playgroundStore });

    const result = await action({
      values: [
        { key: "question", value: "new question" },
        { key: "answer", value: "" },
      ],
    });

    expect(result.ok).toBe(true);
    expect(playgroundStore.getState().input.variablesValueCache).toEqual({
      question: "new question",
      answer: "",
    });
  });

  it("rejects invalid input", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createSetVariableValuesClientAction({ playgroundStore });

    const result = await action({ values: [{ key: "", value: "ignored" }] });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid set_variable_values input.",
      })
    );
    expect(playgroundStore.getState().input.variablesValueCache).toEqual({});
  });
});
