import { PlaygroundState } from "./types";

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
