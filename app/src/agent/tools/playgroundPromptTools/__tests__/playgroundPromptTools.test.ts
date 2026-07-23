import {
  applyWritePromptTools,
  createReadPromptToolsClientAction,
  createWritePromptToolsClientAction,
  getPromptToolsSnapshot,
  parseWritePromptToolsInput,
  type PromptToolsSnapshot,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPromptTools";
import { createAgentStore } from "@phoenix/store/agentStore";
import {
  _resetInstanceId,
  _resetToolId,
  createPlaygroundStore,
  type PlaygroundStore,
  type Tool,
} from "@phoenix/store/playground";

const newStore = () =>
  createPlaygroundStore({ datasetId: null, modelConfigByProvider: {} });

/** Replace the tool list on the default instance (id 0). */
const seedTools = (playgroundStore: PlaygroundStore, tools: Tool[]) => {
  playgroundStore.getState().updateInstance({
    instanceId: 0,
    patch: { tools },
    dirty: false,
  });
};

const revisionOf = (playgroundStore: PlaygroundStore): string => {
  const snapshot = getPromptToolsSnapshot({ playgroundStore });
  if (!snapshot.ok) throw new Error(snapshot.error);
  return snapshot.output.revision;
};

const functionTool = (id: number, name: string, extra = {}): Tool => ({
  kind: "function",
  id,
  editorType: "json",
  definition: { name, ...extra },
});

describe("playground prompt tools agent tools", () => {
  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-agent");
    _resetInstanceId();
    _resetToolId();
  });

  describe("read_prompt_tools", () => {
    it("reads an empty tool list with a revision", async () => {
      const playgroundStore = newStore();
      const read = createReadPromptToolsClientAction({ playgroundStore });

      const result = await read({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const snapshot: PromptToolsSnapshot = JSON.parse(result.output ?? "");
      expect(snapshot.instanceId).toBe(0);
      expect(snapshot.label).toBe("A");
      expect(snapshot.tools).toEqual([]);
      expect(snapshot.revision).toMatch(/^prompt-tools-/);
    });

    // Forward-compat guard: raw (vendor passthrough) tools are read-only today,
    // but the read contract MUST keep surfacing them with a `kind` discriminator
    // so a future raw-write feature has a stable seam to build on.
    it("surfaces raw vendor tools alongside function tools with a kind discriminator", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [
        functionTool(101, "get_weather", {
          description: "Look up weather.",
          parameters: { type: "object" },
        }),
        {
          kind: "raw",
          id: 102,
          editorType: "json",
          raw: { type: "web_search" },
        },
      ]);

      const snapshot = getPromptToolsSnapshot({ playgroundStore });

      expect(snapshot.ok).toBe(true);
      if (!snapshot.ok) return;
      expect(snapshot.output.tools).toEqual([
        expect.objectContaining({
          kind: "function",
          id: 101,
          name: "get_weather",
          description: "Look up weather.",
        }),
        expect.objectContaining({
          kind: "raw",
          id: 102,
          raw: { type: "web_search" },
        }),
      ]);
    });

    it("requires an explicit instanceId when multiple instances exist", () => {
      const playgroundStore = newStore();
      playgroundStore.getState().addInstance();

      const snapshot = getPromptToolsSnapshot({ playgroundStore });

      expect(snapshot).toEqual(
        expect.objectContaining({
          ok: false,
          error: expect.stringContaining("Multiple playground instances"),
        })
      );
    });
  });

  describe("write_prompt_tools — create / update", () => {
    it("creates a single function tool", () => {
      const playgroundStore = newStore();

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ name: "get_weather", parameters: { type: "object" } }],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.results).toEqual([
        { status: "created", toolId: expect.any(Number) },
      ]);
      const tools = playgroundStore.getState().instances[0]!.tools;
      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual(
        expect.objectContaining({
          kind: "function",
          definition: expect.objectContaining({ name: "get_weather" }),
        })
      );
    });

    it("creates several tools in one batch with distinct ids", () => {
      const playgroundStore = newStore();

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ name: "get_weather" }, { name: "get_forecast" }],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.results).toHaveLength(2);
      const [first, second] = result.output.results;
      expect(first!.status).toBe("created");
      expect(second!.status).toBe("created");
      expect(first!.toolId).not.toBe(second!.toolId);
      expect(
        playgroundStore
          .getState()
          .instances[0]!.tools.map((tool) =>
            tool.kind === "function" ? tool.definition.name : tool.kind
          )
      ).toEqual(["get_weather", "get_forecast"]);
    });

    it("patches an existing tool, changing only the fields present in the entry", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [
        functionTool(101, "get_weather", {
          description: "Original description.",
          parameters: { type: "object", properties: { city: {} } },
        }),
      ]);

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [
            {
              id: 101,
              name: "get_weather",
              parameters: {
                type: "object",
                properties: { city: {}, units: {} },
              },
            },
          ],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.results).toEqual([
        { status: "updated", toolId: 101 },
      ]);
      const tool = playgroundStore.getState().instances[0]!.tools[0]!;
      expect(tool.kind).toBe("function");
      if (tool.kind !== "function") return;
      // parameters changed...
      expect(tool.definition.parameters).toEqual({
        type: "object",
        properties: { city: {}, units: {} },
      });
      // ...but the untouched description is preserved (patch semantics).
      expect(tool.definition.description).toBe("Original description.");
    });

    it("composes repeated patches to the same tool within one batch", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [functionTool(101, "get_weather")]);

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [
            { id: 101, name: "get_weather", description: "Set first." },
            { id: 101, name: "get_weather", parameters: { type: "object" } },
          ],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.results).toEqual([
        { status: "updated", toolId: 101 },
        { status: "updated", toolId: 101 },
      ]);
      const tool = playgroundStore.getState().instances[0]!.tools[0]!;
      if (tool.kind !== "function") throw new Error("expected function tool");
      // Both patches landed: the second did not clobber the first.
      expect(tool.definition.description).toBe("Set first.");
      expect(tool.definition.parameters).toEqual({ type: "object" });
    });
  });

  describe("write_prompt_tools — all-or-nothing rejection", () => {
    it("rejects the whole batch when an entry references a missing id, mutating nothing", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [functionTool(101, "existing")]);
      const revision = revisionOf(playgroundStore);

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revision,
          tools: [{ name: "would_be_created" }, { id: 9999, name: "missing" }],
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          ok: false,
          error: expect.stringContaining("tools[1]"),
        })
      );
      if (result.ok) return;
      expect(result.error).toContain("9999");
      // The valid create in tools[0] must NOT have been applied.
      expect(playgroundStore.getState().instances[0]!.tools).toHaveLength(1);
      expect(revisionOf(playgroundStore)).toBe(revision);
    });

    it("rejects editing a raw vendor tool with the offending index, mutating nothing", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [
        {
          kind: "raw",
          id: 200,
          editorType: "json",
          raw: { type: "web_search" },
        },
      ]);

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ id: 200, name: "web_search" }],
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          ok: false,
          error: expect.stringContaining("tools[0]"),
        })
      );
      if (result.ok) return;
      expect(result.error).toMatch(/raw|vendor passthrough/);
      const tool = playgroundStore.getState().instances[0]!.tools[0]!;
      expect(tool.kind).toBe("raw");
    });

    it("rejects a stale batch when the revision no longer matches", () => {
      const playgroundStore = newStore();
      const staleRevision = revisionOf(playgroundStore);
      // Something changes the tool list after the read.
      seedTools(playgroundStore, [functionTool(101, "added_later")]);

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: staleRevision,
          tools: [{ name: "get_weather" }],
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          ok: false,
          error: expect.stringContaining("has changed"),
        })
      );
      expect(playgroundStore.getState().instances[0]!.tools).toHaveLength(1);
    });
  });

  // The tool editors are uncontrolled (CodeMirror); an external write must bump
  // a per-tool revision so the mounted editor remounts and drops its stale
  // initial value. See PlaygroundTools key + markToolsExternallyUpdated.
  describe("write_prompt_tools — external editor refresh", () => {
    it("bumps the external-update revision for created and updated tools", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [functionTool(101, "get_weather")]);
      expect(
        playgroundStore.getState().externallyUpdatedToolRevisionById[101] ?? 0
      ).toBe(0);

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [
            { id: 101, name: "get_weather", description: "updated" },
            { name: "get_forecast" },
          ],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const revById =
        playgroundStore.getState().externallyUpdatedToolRevisionById;
      // The updated tool's editor must be told to refresh...
      expect(revById[101]).toBe(1);
      // ...as well as the newly created one.
      const createdId = result.output.results.find(
        (r) => r.status === "created"
      )!.toolId;
      expect(revById[createdId]).toBe(1);
    });

    it("does not bump the revision for local edits via updateInstance", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [functionTool(101, "get_weather")]);

      // Simulate the user typing in the editor (the path updateTool uses).
      playgroundStore.getState().updateInstance({
        instanceId: 0,
        patch: {
          tools: [functionTool(101, "get_weather", { description: "typed" })],
        },
        dirty: true,
      });

      expect(
        playgroundStore.getState().externallyUpdatedToolRevisionById[101] ?? 0
      ).toBe(0);
    });
  });

  describe("write_prompt_tools — delete", () => {
    it("deletes a function tool by id", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [
        functionTool(101, "get_weather"),
        functionTool(102, "get_forecast"),
      ]);

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [],
          deleteToolIds: [101],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.deletedToolIds).toEqual([101]);
      expect(result.output.results).toEqual([]);
      expect(
        playgroundStore.getState().instances[0]!.tools.map((tool) => tool.id)
      ).toEqual([102]);
    });

    // Deletes are more permissive than writes: removing a tool needs no
    // knowledge of its shape, so raw vendor tools can be deleted via PXI.
    it("deletes a raw vendor tool even though it cannot be written", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [
        {
          kind: "raw",
          id: 200,
          editorType: "json",
          raw: { type: "web_search" },
        },
      ]);

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [],
          deleteToolIds: [200],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.deletedToolIds).toEqual([200]);
      expect(playgroundStore.getState().instances[0]!.tools).toHaveLength(0);
    });

    it("deletes and creates atomically in one batch", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [functionTool(101, "old_tool")]);

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ name: "new_tool" }],
          deleteToolIds: [101],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.deletedToolIds).toEqual([101]);
      expect(result.output.results).toEqual([
        { status: "created", toolId: expect.any(Number) },
      ]);
      expect(
        playgroundStore
          .getState()
          .instances[0]!.tools.map((tool) =>
            tool.kind === "function" ? tool.definition.name : tool.kind
          )
      ).toEqual(["new_tool"]);
    });

    it("rejects the whole batch when a delete id is missing, mutating nothing", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [functionTool(101, "existing")]);
      const revision = revisionOf(playgroundStore);

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revision,
          tools: [{ name: "would_be_created" }],
          deleteToolIds: [9999],
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          ok: false,
          error: expect.stringContaining("deleteToolIds"),
        })
      );
      if (result.ok) return;
      expect(result.error).toContain("9999");
      expect(playgroundStore.getState().instances[0]!.tools).toHaveLength(1);
      expect(revisionOf(playgroundStore)).toBe(revision);
    });

    it("rejects updating and deleting the same tool in one batch", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [functionTool(101, "get_weather")]);

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ id: 101, name: "get_weather", description: "patched" }],
          deleteToolIds: [101],
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          ok: false,
          error: expect.stringContaining("both updated and deleted"),
        })
      );
      const tool = playgroundStore.getState().instances[0]!.tools[0]!;
      expect(tool.kind === "function" && tool.definition.description).toBe(
        undefined
      );
    });

    it("resets the tool choice to auto when deleting the forced-choice tool", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [functionTool(101, "get_weather")]);
      playgroundStore.getState().updateInstance({
        instanceId: 0,
        patch: {
          toolChoice: {
            type: "SPECIFIC_FUNCTION",
            functionName: "get_weather",
          },
        },
        dirty: false,
      });

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [],
          deleteToolIds: [101],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.deletedToolIds).toEqual([101]);
      expect(result.output.resetToolChoiceFrom).toBe("get_weather");
      expect(playgroundStore.getState().instances[0]!.tools).toHaveLength(0);
      expect(playgroundStore.getState().instances[0]!.toolChoice).toEqual({
        type: "ZERO_OR_MORE",
      });
    });

    it("leaves an unrelated forced tool choice untouched when deleting a different tool", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [
        functionTool(101, "get_weather"),
        functionTool(102, "get_forecast"),
      ]);
      playgroundStore.getState().updateInstance({
        instanceId: 0,
        patch: {
          toolChoice: {
            type: "SPECIFIC_FUNCTION",
            functionName: "get_weather",
          },
        },
        dirty: false,
      });

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [],
          deleteToolIds: [102],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.resetToolChoiceFrom).toBeUndefined();
      expect(playgroundStore.getState().instances[0]!.toolChoice).toEqual({
        type: "SPECIFIC_FUNCTION",
        functionName: "get_weather",
      });
    });

    it("follows the rename when the forced-choice tool is renamed via an update", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [functionTool(101, "get_weather")]);
      playgroundStore.getState().updateInstance({
        instanceId: 0,
        patch: {
          toolChoice: {
            type: "SPECIFIC_FUNCTION",
            functionName: "get_weather",
          },
        },
        dirty: false,
      });

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ id: 101, name: "fetch_weather" }],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.renamedToolChoiceTo).toBe("fetch_weather");
      expect(result.output.resetToolChoiceFrom).toBeUndefined();
      expect(playgroundStore.getState().instances[0]!.toolChoice).toEqual({
        type: "SPECIFIC_FUNCTION",
        functionName: "fetch_weather",
      });
    });

    it("leaves the forced tool choice untouched when renaming a different tool", () => {
      const playgroundStore = newStore();
      seedTools(playgroundStore, [
        functionTool(101, "get_weather"),
        functionTool(102, "get_forecast"),
      ]);
      playgroundStore.getState().updateInstance({
        instanceId: 0,
        patch: {
          toolChoice: {
            type: "SPECIFIC_FUNCTION",
            functionName: "get_weather",
          },
        },
        dirty: false,
      });

      const result = applyWritePromptTools({
        playgroundStore,
        input: {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ id: 102, name: "weekly_forecast" }],
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.renamedToolChoiceTo).toBeUndefined();
      expect(result.output.resetToolChoiceFrom).toBeUndefined();
      expect(playgroundStore.getState().instances[0]!.toolChoice).toEqual({
        type: "SPECIFIC_FUNCTION",
        functionName: "get_weather",
      });
    });
  });

  describe("input parsing", () => {
    it("normalizes snake_case and the `revision` alias", () => {
      const parsed = parseWritePromptToolsInput({
        instance_id: 0,
        revision: "prompt-tools-abc",
        tools: [{ name: "get_weather" }],
      });

      expect(parsed).toEqual({
        instanceId: 0,
        expectedRevision: "prompt-tools-abc",
        tools: [{ name: "get_weather" }],
      });
    });

    it("accepts a delete-only batch and normalizes the delete_tool_ids alias", () => {
      const parsed = parseWritePromptToolsInput({
        instanceId: 0,
        expectedRevision: "prompt-tools-abc",
        delete_tool_ids: [3, 4],
      });

      expect(parsed).toEqual({
        instanceId: 0,
        expectedRevision: "prompt-tools-abc",
        deleteToolIds: [3, 4],
      });
    });

    it("rejects a batch with neither tools nor deletes", () => {
      expect(
        parseWritePromptToolsInput({
          instanceId: 0,
          expectedRevision: "prompt-tools-abc",
          tools: [],
        })
      ).toBeNull();
    });

    it("drops a null id (create) but keeps a numeric id (update)", () => {
      const parsed = parseWritePromptToolsInput({
        instanceId: 0,
        expectedRevision: "prompt-tools-abc",
        tools: [
          { name: "to_create", id: null },
          { name: "to_update", id: 7 },
        ],
      });

      expect(parsed).not.toBeNull();
      const tools = parsed!.tools ?? [];
      expect("id" in tools[0]!).toBe(false);
      expect(tools[1]).toEqual({ name: "to_update", id: 7 });
    });
  });

  describe("write_prompt_tools client action — approval flow", () => {
    const makeWriteAction = (
      playgroundStore: PlaygroundStore,
      agentStore: ReturnType<typeof createAgentStore>,
      shouldAutoAccept?: () => boolean
    ) =>
      createWritePromptToolsClientAction({
        playgroundStore,
        setPendingPromptToolWrite:
          agentStore.getState().setPendingPromptToolWrite,
        ...(shouldAutoAccept ? { shouldAutoAccept } : {}),
      });

    it("queues the batch as a pending diff and applies it on accept", async () => {
      const playgroundStore = newStore();
      const agentStore = createAgentStore();
      const write = makeWriteAction(playgroundStore, agentStore);
      const addToolOutput = vi.fn().mockResolvedValue(undefined);

      const result = await write(
        {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ name: "get_weather" }],
        },
        { toolCallId: "tc-1", sessionId: "s-1", addToolOutput }
      );

      expect(result.ok).toBe(true);
      expect(addToolOutput).not.toHaveBeenCalled();
      expect(playgroundStore.getState().instances[0]!.tools).toHaveLength(0);
      const pending =
        agentStore.getState().pendingPromptToolWritesByToolCallId["tc-1"];
      expect(pending).toBeDefined();
      expect(pending!.summary.created).toEqual(["get_weather"]);
      expect(pending!.before.entries).toHaveLength(0);
      expect(pending!.after.entries).toHaveLength(1);
      expect(pending!.after.entries[0]!.name).toBe("get_weather");

      await pending!.accept!();

      expect(playgroundStore.getState().instances[0]!.tools).toHaveLength(1);
      expect(addToolOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          state: "output-available",
          tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: "tc-1",
          output: expect.objectContaining({ status: "accepted" }),
        })
      );
      expect(
        agentStore.getState().pendingPromptToolWritesByToolCallId["tc-1"]
      ).toBeUndefined();
    });

    it("discards the batch on reject, leaving the tools untouched", async () => {
      const playgroundStore = newStore();
      const agentStore = createAgentStore();
      seedTools(playgroundStore, [functionTool(101, "get_weather")]);
      const write = makeWriteAction(playgroundStore, agentStore);
      const addToolOutput = vi.fn().mockResolvedValue(undefined);

      await write(
        {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          deleteToolIds: [101],
        },
        { toolCallId: "tc-reject", sessionId: "s-1", addToolOutput }
      );
      const pending =
        agentStore.getState().pendingPromptToolWritesByToolCallId["tc-reject"];
      expect(pending).toBeDefined();
      expect(pending!.summary.deleted).toEqual(["get_weather"]);

      await pending!.reject!();

      expect(playgroundStore.getState().instances[0]!.tools).toHaveLength(1);
      expect(addToolOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          state: "output-available",
          tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: "tc-reject",
          output: expect.objectContaining({ status: "rejected" }),
        })
      );
    });

    it("applies immediately and reports auto-approval when auto-accept is on", async () => {
      const playgroundStore = newStore();
      const agentStore = createAgentStore();
      const write = makeWriteAction(playgroundStore, agentStore, () => true);
      const addToolOutput = vi.fn().mockResolvedValue(undefined);

      const result = await write(
        {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ name: "get_weather" }],
        },
        { toolCallId: "tc-auto", sessionId: "s-1", addToolOutput }
      );

      expect(result.ok).toBe(true);
      expect(playgroundStore.getState().instances[0]!.tools).toHaveLength(1);
      expect(
        agentStore.getState().pendingPromptToolWritesByToolCallId["tc-auto"]
      ).toBeUndefined();
      expect(addToolOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
          output: expect.objectContaining({
            status: "accepted",
            acceptedBy: "auto",
          }),
        })
      );
    });

    it("fails fast with the indexed error for an invalid batch, registering no diff", async () => {
      const playgroundStore = newStore();
      const agentStore = createAgentStore();
      seedTools(playgroundStore, [functionTool(101, "existing")]);
      const write = makeWriteAction(playgroundStore, agentStore);
      const addToolOutput = vi.fn().mockResolvedValue(undefined);

      const result = await write(
        {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ name: "would_be_created" }, { id: 9999, name: "missing" }],
        },
        { toolCallId: "tc-bad", sessionId: "s-1", addToolOutput }
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toContain("tools[1]");
      expect(result.error).toContain("9999");
      expect(
        agentStore.getState().pendingPromptToolWritesByToolCallId["tc-bad"]
      ).toBeUndefined();
      expect(addToolOutput).not.toHaveBeenCalled();
      expect(playgroundStore.getState().instances[0]!.tools).toHaveLength(1);
    });

    it("rejects the accept if the tool list drifted after the diff was proposed", async () => {
      const playgroundStore = newStore();
      const agentStore = createAgentStore();
      const write = makeWriteAction(playgroundStore, agentStore);
      const addToolOutput = vi.fn().mockResolvedValue(undefined);

      await write(
        {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ name: "get_weather" }],
        },
        { toolCallId: "tc-stale", sessionId: "s-1", addToolOutput }
      );
      seedTools(playgroundStore, [functionTool(101, "added_later")]);

      const pending =
        agentStore.getState().pendingPromptToolWritesByToolCallId["tc-stale"];
      await pending!.accept!();

      expect(addToolOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          state: "output-error",
          tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: "tc-stale",
          errorText: expect.stringContaining("has changed"),
        })
      );
      expect(
        playgroundStore
          .getState()
          .instances[0]!.tools.map((tool) =>
            tool.kind === "function" ? tool.definition.name : tool.kind
          )
      ).toEqual(["added_later"]);
    });

    it("rejects the accept if the provider changed after the diff was proposed", async () => {
      const playgroundStore = newStore();
      const agentStore = createAgentStore();
      const write = makeWriteAction(playgroundStore, agentStore);
      const addToolOutput = vi.fn().mockResolvedValue(undefined);

      await write(
        {
          instanceId: 0,
          expectedRevision: revisionOf(playgroundStore),
          tools: [{ name: "get_weather" }],
        },
        { toolCallId: "tc-provider-stale", sessionId: "s-1", addToolOutput }
      );
      const pending =
        agentStore.getState().pendingPromptToolWritesByToolCallId[
          "tc-provider-stale"
        ];
      playgroundStore.getState().updateInstance({
        instanceId: 0,
        patch: {
          model: {
            ...playgroundStore.getState().instances[0]!.model,
            provider: "ANTHROPIC",
          },
        },
        dirty: false,
      });

      await pending!.accept!();

      expect(addToolOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          state: "output-error",
          tool: WRITE_PROMPT_TOOLS_TOOL_NAME,
          toolCallId: "tc-provider-stale",
          errorText: expect.stringContaining("provider changed"),
        })
      );
      expect(playgroundStore.getState().instances[0]!.tools).toHaveLength(0);
      expect(
        agentStore.getState().pendingPromptToolWritesByToolCallId[
          "tc-provider-stale"
        ]
      ).toBeUndefined();
    });

    it("requires tool call context", async () => {
      const playgroundStore = newStore();
      const agentStore = createAgentStore();
      const write = makeWriteAction(playgroundStore, agentStore);

      const result = await write({
        instanceId: 0,
        expectedRevision: revisionOf(playgroundStore),
        tools: [{ name: "get_weather" }],
      });

      expect(result).toEqual(
        expect.objectContaining({
          ok: false,
          error: expect.stringContaining("without tool call context"),
        })
      );
    });

    it("reports invalid input", async () => {
      const playgroundStore = newStore();
      const agentStore = createAgentStore();
      const write = makeWriteAction(playgroundStore, agentStore);

      const result = await write(
        { instanceId: 0, tools: [] },
        { toolCallId: "tc-x", sessionId: "s-1", addToolOutput: vi.fn() }
      );

      expect(result).toEqual(
        expect.objectContaining({
          ok: false,
          error: expect.stringContaining("Invalid write_prompt_tools input"),
        })
      );
    });
  });
});
