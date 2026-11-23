import type { ReactNode } from "react";
import { createContext, useCallback, useContext } from "react";
import { UNSTABLE_ToastQueue as ToastQueue } from "react-aria-components";

/**
 * Default duration in milliseconds before toasts expire by default.
 */
const DEFAULT_EXPIRY = 5_000;

/**
 * Maximum number of toasts rendered at once. Additional toasts are queued and
 * shown as visible ones are dismissed. Matches the sonner-style stacked region.
 */
const MAX_VISIBLE_TOASTS = 3;

type NotificationVariant = "success" | "error";

export type NotificationParams = {
  title: string;
  message?: string;
  variant?: NotificationVariant;
  /**
   * Action to be taken when the notification is interacted with.
   * By default, this will render as a button, but a custom component can be provided.
   * By default, the toast will close when the action is clicked.
   */
  action?:
    | {
        /**
         * Text to display in the action button.
         */
        text: string;
        /**
         * Callback function to be called when the action is clicked.
         * The function receives a `close` function as an argument, which can be called to close the toast.
         */
        onClick: (close: () => void) => void;
        /**
         * Whether to close the toast when the action is clicked.
         * @default true
         */
        closeOnClick?: boolean;
      }
    | React.ReactNode;
};

export type NotificationQueue = ToastQueue<NotificationParams>;

export const createToastQueue = (): NotificationQueue =>
  new ToastQueue<NotificationParams>({
    maxVisibleToasts: MAX_VISIBLE_TOASTS,
  });

export const toastQueue = createToastQueue();

const ToastQueueContext = createContext<NotificationQueue>(toastQueue);

/**
 * Scopes the notification hooks and `ToastRegion` beneath it to `queue`
 * instead of the app-wide queue, so a region only shows the toasts raised
 * within the same provider.
 */
export function ToastQueueProvider({
  queue,
  children,
}: {
  queue: NotificationQueue;
  children: ReactNode;
}) {
  return (
    <ToastQueueContext.Provider value={queue}>
      {children}
    </ToastQueueContext.Provider>
  );
}

/**
 * The queue the notification hooks add to: the nearest
 * `ToastQueueProvider`'s, or the app-wide queue.
 */
export const useToastQueue = () => useContext(ToastQueueContext);

export type NotificationHookParams = Omit<NotificationParams, "variant"> & {
  /**
   * Duration in milliseconds before the notification expires.
   *
   * A good rule of thumb is to allow 5000ms to pass before dismissing the notification.
   * The timer starts when the toast becomes visible. While the toast region is hovered or
   * focused, every visible toast's timer is paused, and it resumes with the time that was
   * left when hover and focus leave.
   *
   * Pass null to unset the expiration timer.
   *
   * @default 5000 - 5 seconds
   */
  expireMs?: number | null;
};

/**
 * Trigger a notification with the default variant.
 *
 * @param params Notification parameters.
 * @returns A callback that triggers a notification.
 * The callback returns a key that can be later used to programmatically dismiss the notification.
 */
export const useNotify = () => {
  const queue = useToastQueue();
  return useCallback(
    ({ expireMs = DEFAULT_EXPIRY, ...params }: NotificationHookParams) =>
      queue.add(
        { ...params },
        expireMs === null ? undefined : { timeout: expireMs }
      ),
    [queue]
  );
};

/**
 * Trigger a notification with the success variant.
 *
 * @param params Notification parameters.
 * @returns A callback that triggers a notification. The callback returns a key that can be later used to programmatically dismiss the notification.
 * @example // Timed dismissal after 5 seconds
 * const notifySuccess = useNotifySuccess();
 * notifySuccess({ title: "Success", message: "Operation completed successfully.", expireMs: 5000 });
 * @example // Programmatic dismissal
 * const queue = useToastQueue();
 * const notifySuccess = useNotifySuccess();
 * const key = notifySuccess({ title: "Success", message: "Operation completed successfully." });
 * // later on...
 * queue.close(key);
 */
export const useNotifySuccess = () => {
  const queue = useToastQueue();
  return useCallback(
    ({ expireMs = DEFAULT_EXPIRY, ...params }: NotificationHookParams) =>
      queue.add(
        {
          ...params,
          variant: "success",
        },
        expireMs === null ? undefined : { timeout: expireMs }
      ),
    [queue]
  );
};

/**
 * Trigger a notification with the error variant.
 *
 * @param params Notification parameters.
 * @returns A callback that triggers a notification. The callback returns a key that can be later used to programmatically dismiss the notification.
 */
export const useNotifyError = () => {
  const queue = useToastQueue();
  return useCallback(
    ({ expireMs = DEFAULT_EXPIRY, ...params }: NotificationHookParams) =>
      queue.add(
        {
          ...params,
          variant: "error",
        },
        expireMs === null ? undefined : { timeout: expireMs }
      ),
    [queue]
  );
};
