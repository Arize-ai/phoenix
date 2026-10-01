import type { PlaygroundNormalizedInstance, PlaygroundState } from "./types";

/**
 * Curried selector to get an instance by id
 * @param instanceId
 * @returns selector function that returns the instance for the given id
 */
export const selectPlaygroundInstance =
  (instanceId: number) => (state: PlaygroundState) =>
    state.instances.find((instance) => instance.id === instanceId);

/**
 * Curried selector to get all messages for a given instance
 * @param instanceId
 * @returns selector function that returns all messages for the given instance
 */
export const selectPlaygroundInstanceMessages =
  (instanceId: number) => (state: PlaygroundState) => {
    const instance = selectPlaygroundInstance(instanceId)(state);
    if (!instance) {
      return [];
    }
    if (instance.template.__type !== "chat") {
      return [];
    }
    return instance.template.messageIds.map(
      (id) => state.allInstanceMessages[id]
    );
  };

/**
 * Curried selector to get a message of a given id
 * @param messageId
 * @returns selector function that returns the message for the given id
 */
export const selectPlaygroundInstanceMessage =
  (messageId: number) => (state: PlaygroundState) => {
    return state.allInstanceMessages[messageId];
  };

/**
 * Equality for `state.instances` that ignores each instance's
 * `experimentRunProgress`. Every streamed run event bumps a counter there and
 * replaces the array, so a subscriber that only reads the instances' shape —
 * what the tasks are, which are running, which experiment each produced —
 * would otherwise re-render, and rebuild everything hanging off it, once per
 * event. Pair it with a selector of `state.instances`; the array handed back
 * may carry stale progress counters, so read progress through its own
 * selector instead.
 */
export function arePlaygroundInstancesEqualExceptProgress(
  left: ReadonlyArray<PlaygroundNormalizedInstance>,
  right: ReadonlyArray<PlaygroundNormalizedInstance>
): boolean {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((instance, index) =>
    isInstanceEqualExceptProgress(instance, right[index])
  );
}

function isInstanceEqualExceptProgress(
  left: PlaygroundNormalizedInstance,
  right: PlaygroundNormalizedInstance
): boolean {
  if (left === right) {
    return true;
  }

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  keys.delete("experimentRunProgress");

  for (const key of keys) {
    if (
      left[key as keyof PlaygroundNormalizedInstance] !==
      right[key as keyof PlaygroundNormalizedInstance]
    ) {
      return false;
    }
  }

  return true;
}
