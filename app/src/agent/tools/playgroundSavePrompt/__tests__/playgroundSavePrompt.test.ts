import {
  parseSavePromptInput,
  savePlaygroundPrompt,
  type SavePromptMutationCommitter,
} from "@phoenix/agent/tools/playgroundSavePrompt";
import {
  _resetInstanceId,
  _resetMessageId,
  createPlaygroundStore,
} from "@phoenix/store/playground";

describe("playground save prompt agent tool", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
  });

  it("parses common save_prompt input aliases", () => {
    expect(
      parseSavePromptInput({
        instance_id: 3,
        prompt_name: "candidate_prompt",
        tag_names: ["staging"],
      })
    ).toEqual({
      instanceId: 3,
      name: "candidate_prompt",
      tags: ["staging"],
    });
  });

  it("saves the mounted instance to its associated prompt and clears dirty state", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().updateInstance({
      instanceId: 0,
      patch: {
        prompt: {
          id: "prompt-id",
          name: "existing_prompt",
          version: "old-version-id",
          tag: "development",
        },
      },
      dirty: true,
    });
    const commitPrompt: SavePromptMutationCommitter = vi
      .fn()
      .mockResolvedValue({
        promptId: "prompt-id",
        promptName: "existing_prompt",
        promptVersionId: "new-version-id",
      });

    const result = await savePlaygroundPrompt({
      playgroundStore,
      input: { description: "Tighten instructions" },
      commitPrompt,
    });

    expect(result.ok).toBe(true);
    expect(commitPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "update",
        input: expect.objectContaining({
          promptId: "prompt-id",
          promptVersion: expect.objectContaining({
            description: "Tighten instructions",
          }),
          tags: [
            {
              name: "development",
              description: "The version deployed for development",
            },
          ],
        }),
      })
    );
    const state = playgroundStore.getState();
    expect(state.dirtyInstances[0]).toBe(false);
    expect(state.instances[0]?.prompt).toEqual({
      id: "prompt-id",
      name: "existing_prompt",
      version: "new-version-id",
      tag: "development",
    });
  });

  it("creates a prompt when the instance is unsaved and a name is provided", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    const commitPrompt: SavePromptMutationCommitter = vi
      .fn()
      .mockResolvedValue({
        promptId: "created-prompt-id",
        promptName: "created_prompt",
        promptVersionId: "created-version-id",
      });

    const result = await savePlaygroundPrompt({
      playgroundStore,
      input: { name: "created_prompt", tags: [] },
      commitPrompt,
    });

    expect(result.ok).toBe(true);
    expect(commitPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "create",
        input: expect.objectContaining({
          name: "created_prompt",
          tags: null,
        }),
      })
    );
    expect(playgroundStore.getState().instances[0]?.prompt).toEqual({
      id: "created-prompt-id",
      name: "created_prompt",
      version: "created-version-id",
      tag: null,
    });
  });

  it("derives a prompt name when saving an unsaved instance without a name", async () => {
    const playgroundStore = createPlaygroundStore({
      datasetId: null,
      modelConfigByProvider: {},
    });
    playgroundStore.getState().updateMessage({
      instanceId: 0,
      messageId: 0,
      patch: {
        content: "You are a recipe creation assistant.",
      },
    });
    const commitPrompt: SavePromptMutationCommitter = vi
      .fn()
      .mockResolvedValue({
        promptId: "created-prompt-id",
        promptName: "recipe-creation-assistant_0",
        promptVersionId: "created-version-id",
      });

    const result = await savePlaygroundPrompt({
      playgroundStore,
      input: {},
      commitPrompt,
    });

    expect(result.ok).toBe(true);
    expect(commitPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "create",
        input: expect.objectContaining({
          name: "recipe-creation-assistant_0",
        }),
      })
    );
  });
});
