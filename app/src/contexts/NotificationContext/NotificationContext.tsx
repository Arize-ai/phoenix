import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useState,
} from "react";
import { UNSTABLE_ToastQueue as ToastQueue } from "react-aria-components";
import { flushSync } from "react-dom";

type NotificationContext = {
  queue: ToastQueue<NotificationParams>;
};

/**
 * Default duration in milliseconds before toasts expire by default.
 */
const DEFAULT_EXPIRY = 5_000;

const NotificationContext = createContext<NotificationContext | null>(null);

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

const createToastQueue = (
  ...args: ConstructorParameters<typeof ToastQueue<NotificationParams>>
) => new ToastQueue<NotificationParams>(...args);

export const NotificationProvider = ({
  children,
}: PropsWithChildren): JSX.Element => {
  const [queue] = useState(() =>
    createToastQueue({
      // Wrap state updates in a CSS view transition.
      wrapUpdate(fn) {
        if ("startViewTransition" in document) {
          // @ts-expect-error this will error until we upgrade our version of typescript
          document?.startViewTransition(() => {
            flushSync(fn);
          });
        } else {
          fn();
        }
      },
    })
  );
  return (
    <NotificationContext.Provider value={{ queue }}>
      {children}
    </NotificationContext.Provider>
  );
};

export type NotificationHookParams = Omit<NotificationParams, "variant"> & {
  /**
   * Duration in milliseconds before the notification expires.
   *
   * A good rule of thumb is to allow 5000ms to pass before dismissing the notification.
   * If the toast is hovered or focused, the toast will not be dismissed, and the timer will restart
   * when focus/hover is lost.
   *
   * Pass null to unset the expiration timer.
   *
   * @default 5000 - 5 seconds
   */
  expireMs?: number | null;
};

export const useNotificationQueue = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within a NotificationProvider"
    );
  }
  return context.queue;
};

/**
 * Trigger a notification with the default variant.
 *
 * @param params Notification parameters.
 * @returns A callback that triggers a notification.
 * The callback returns a key that can be later used to programmatically dismiss the notification.
 */
export const useNotify = () => {
  const queue = useNotificationQueue();
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
 * const queue = useNotificationQueue();
 * const notifySuccess = useNotifySuccess();
 * const key = notifySuccess({ title: "Success", message: "Operation completed successfully." });
 * // later on...
 * queue.dismiss(key);
 */
export const useNotifySuccess = () => {
  const queue = useNotificationQueue();
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
 * @example // Timed dismissal after 5 seconds
 * const notifyError = useNotifyError();
 * notifyError({ title: "Error", message: "Operation failed.", expireMs: 5000 });
 * @example // Programmatic dismissal
 * const queue = useNotificationQueue();
 * const notifyError = useNotifyError();
 * const key = notifyError({ title: "Error", message: "Operation failed." });
 * // later on...
 * queue.dismiss(key);
 */
export const useNotifyError = () => {
  const queue = useNotificationQueue();
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
