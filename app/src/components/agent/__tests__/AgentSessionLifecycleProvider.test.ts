import { createAgentStore } from "@phoenix/store/agentStore";

import {
  createDraftSessionLifecycle,
  isSessionDeleteDisabled,
} from "../AgentSessionLifecycleProvider";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createLifecycle() {
  const store = createAgentStore();
  const creation = createDeferred<string>();
  const createPersistedSession = vi.fn(() => creation.promise);
  const deletePersistedSession = vi.fn(async () => undefined);
  const refetchSessions = vi.fn(async () => undefined);
  const notifyCreateError = vi.fn();
  const notifyCleanupError = vi.fn();
  const lifecycle = createDraftSessionLifecycle({
    store,
    createPersistedSession,
    deletePersistedSession,
    refetchSessions,
    notifyCreateError,
    notifyCleanupError,
  });
  return {
    store,
    creation,
    lifecycle,
    createPersistedSession,
    deletePersistedSession,
    refetchSessions,
  };
}

describe("draft session lifecycle", () => {
  it("creates, promotes, and exposes a clear-command message exactly once", async () => {
    const { store, creation, lifecycle, createPersistedSession } =
      createLifecycle();
    const draftSessionId = store.getState().createSession();
    const message = { text: "fix this", requestedSkills: ["debug"] };

    lifecycle.stageMessage(draftSessionId, message);
    lifecycle.stageMessage(draftSessionId, message);
    expect(createPersistedSession).toHaveBeenCalledTimes(1);

    creation.resolve("persisted-session");
    await vi.waitFor(() => {
      expect(store.getState().activeSessionId).toBe("persisted-session");
    });

    expect(store.getState().consumePendingMessage("persisted-session")).toEqual(
      message
    );
    expect(
      store.getState().consumePendingMessage("persisted-session")
    ).toBeNull();
  });

  it("continues creation after the submitting view is gone", async () => {
    const { store, creation, lifecycle, refetchSessions } = createLifecycle();
    const draftSessionId = store.getState().createSession();

    lifecycle.stageMessage(draftSessionId, {
      text: "continue headlessly",
      requestedSkills: [],
    });
    creation.resolve("persisted-session");

    await vi.waitFor(() => {
      expect(refetchSessions).toHaveBeenCalledTimes(1);
    });
    expect(
      store.getState().pendingMessageBySessionId["persisted-session"]
    ).toEqual({ text: "continue headlessly", requestedSkills: [] });
  });

  it("stops creation and deletes a session that the server creates afterward", async () => {
    const { store, creation, lifecycle, deletePersistedSession } =
      createLifecycle();
    const draftSessionId = store.getState().createSession();
    lifecycle.stageMessage(draftSessionId, {
      text: "cancel me",
      requestedSkills: [],
    });

    lifecycle.cancelDraftCreation(draftSessionId);
    expect(
      store.getState().sessionOperationById[draftSessionId]
    ).toBeUndefined();
    expect(store.getState().sessionStateById[draftSessionId]).toBeDefined();
    creation.resolve("cancelled-persisted-session");

    await vi.waitFor(() => {
      expect(deletePersistedSession).toHaveBeenCalledWith(
        "cancelled-persisted-session"
      );
    });
    expect(store.getState().pendingMessageBySessionId).toEqual({});
  });

  it("does not resurrect a draft deleted while creation is in flight", async () => {
    const { store, creation, lifecycle, deletePersistedSession } =
      createLifecycle();
    const draftSessionId = store.getState().createSession();
    lifecycle.stageMessage(draftSessionId, {
      text: "delete me",
      requestedSkills: [],
    });

    lifecycle.cancelDraftCreation(draftSessionId);
    store.getState().deleteSession(draftSessionId);
    creation.resolve("orphaned-persisted-session");

    await vi.waitFor(() => {
      expect(deletePersistedSession).toHaveBeenCalledWith(
        "orphaned-persisted-session"
      );
    });
    expect(store.getState().activeSessionId).toBeNull();
    expect(store.getState().sessionStateById).toEqual({});
  });
});

describe("session operation locking", () => {
  it.each(["creating", "rewinding", "forking"] as const)(
    "disables deletion while a session is %s",
    (operation) => {
      expect(isSessionDeleteDisabled({ status: "ready", operation })).toBe(
        true
      );
    }
  );

  it("disables deletion while client tool interaction is unresolved", () => {
    expect(
      isSessionDeleteDisabled({
        status: "ready",
        hasUnresolvedToolCalls: true,
      })
    ).toBe(true);
  });
});
