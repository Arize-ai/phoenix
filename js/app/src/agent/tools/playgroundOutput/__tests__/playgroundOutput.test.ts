import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { createReadPlaygroundOutputClientAction } from "@phoenix/agent/tools/playgroundOutput";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

installTestStorage();

describe("playground output agent tool", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("rejects reads before any run data is available", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createReadPlaygroundOutputClientAction({ playgroundStore });

    const result = await action({});

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("No playground run output"),
      })
    );
  });

  it("rejects unexpected input fields", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const action = createReadPlaygroundOutputClientAction({ playgroundStore });

    const result = await action({ instanceId: 0, extra: true });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Invalid read_playground_output input.",
      })
    );
  });
});
