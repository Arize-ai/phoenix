import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { UNSTABLE_ToastStateContext as ToastStateContext } from "react-aria-components";
import { UNSAFE_PortalProvider } from "react-aria/PortalProvider";
import { useToastQueue as useToastQueueState } from "react-stately";

import { Toast } from "@phoenix/components";
import { ToastRegion } from "@phoenix/components/core/toast/ToastRegion";
import type {
  NotificationHookParams,
  NotificationQueue,
} from "@phoenix/contexts";
import {
  createToastQueue,
  ToastQueueProvider,
  useNotify,
  useNotifyError,
  useNotifySuccess,
  useToastQueue,
} from "@phoenix/contexts";

/** The hook a call site raises a toast with, which sets its variant. */
export type NotifyHook = "useNotify" | "useNotifySuccess" | "useNotifyError";

/** Returns the notifier for each hook, so a story can pick one by name. */
export function useNotifiers(): Record<
  NotifyHook,
  (params: NotificationHookParams) => string
> {
  return {
    useNotify: useNotify(),
    useNotifySuccess: useNotifySuccess(),
    useNotifyError: useNotifyError(),
  };
}

/**
 * Raises one toast through `hook` when it mounts, with no expiry, and closes
 * it when it unmounts.
 */
export function ToastOnMount({
  hook,
  ...params
}: Omit<NotificationHookParams, "expireMs"> & { hook: NotifyHook }) {
  const notify = useNotifiers()[hook];
  const queue: NotificationQueue & { release?: (key: string) => void } =
    useToastQueue();
  const [initialParams] = useState(params);
  useEffect(() => {
    const key = notify({ ...initialParams, expireMs: null });
    return () => (queue.release ?? queue.close.bind(queue))(key);
  }, [notify, queue, initialParams]);
  return null;
}

/**
 * A queue whose `close` does nothing, so neither the close button nor an
 * action can remove a toast. `release` is the real close, for unmounting.
 */
function createHeldQueue() {
  const queue = createToastQueue();
  const release = queue.close.bind(queue);
  return Object.assign(queue, { close: () => {}, release });
}

const heldToastCSS = css`
  .toast-positioner {
    position: relative;
    transform: none;
  }
  .react-aria-Toast {
    animation: none;
  }
`;

function HeldToastList({ width }: { width: number }) {
  const state = useToastQueueState(useToastQueue());
  return (
    <ToastStateContext.Provider value={state}>
      <div css={heldToastCSS} style={{ width }}>
        {state.visibleToasts.map((toast) => (
          <Toast key={toast.key} toast={toast} />
        ))}
      </div>
    </ToastStateContext.Provider>
  );
}

/**
 * One toast raised through `hook` and held open, for a story about what a
 * toast contains. It renders in the page flow rather than in a
 * `ToastRegion`, without the region's stacking offset or entrance
 * animation; `ToastStage` shows the region itself. React Aria's landmark
 * manager degrades with every region on a page until the page crashes, so
 * a Docs page cannot hold a region per example.
 */
export function HeldToast({
  width,
  ...params
}: Omit<NotificationHookParams, "expireMs"> & {
  hook: NotifyHook;
  width: number;
}) {
  const [queue] = useState(createHeldQueue);
  return (
    <ToastQueueProvider queue={queue}>
      <ToastOnMount {...params} />
      <HeldToastList width={width} />
    </ToastQueueProvider>
  );
}

const stageCSS = css`
  position: relative;
  box-sizing: border-box;
  flex: none;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

/**
 * A stand-in for the application viewport that `Layout` portals the
 * `ToastRegion` into, drawn as a bordered box, so a story's toasts appear
 * at the top of the stage rather than at the top of the page. Each stage
 * owns a queue: the notification hooks beneath it and its region use that
 * queue, so the stages in the two theme panels, or in two stories on one
 * Docs page, never show each other's toasts. `children` render beside the
 * stage, in `direction`, and raise toasts into it.
 */
export function ToastStage({
  width,
  height,
  direction = "column",
  children,
}: {
  width: number;
  height: number;
  direction?: "row" | "column";
  children?: ReactNode;
}) {
  const [queue] = useState(createToastQueue);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <ToastQueueProvider queue={queue}>
      <div
        css={css`
          display: flex;
          flex-direction: ${direction};
          align-items: flex-start;
          gap: var(--global-dimension-size-200);
        `}
      >
        <div ref={setStage} css={stageCSS} style={{ width, height }}>
          {stage && (
            <UNSAFE_PortalProvider getContainer={() => stage}>
              <ToastRegion />
            </UNSAFE_PortalProvider>
          )}
        </div>
        {children}
      </div>
    </ToastQueueProvider>
  );
}
