import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button, Flex, Link, Text, Toast } from "@phoenix/components";
import { ToastRegion } from "@phoenix/components/core/toast/ToastRegion";
import type { NotificationHookParams } from "@phoenix/contexts";
import { useToastQueue } from "@phoenix/contexts";

import { OptionGrid } from "../../utils/OptionGrid";
import type { NotifyHook } from "../../utils/ToastStage";
import {
  HeldToast,
  ToastOnMount,
  ToastStage,
  useNotifiers,
} from "../../utils/ToastStage";

/**
 * A transient notification about something that just happened. Raise one
 * with the hook that sets its variant — `useNotify`, `useNotifySuccess` or
 * `useNotifyError` — and the app's `ToastRegion` shows it at the top center
 * of the application viewport. The bordered stages below stand in for that
 * viewport, each with its own queue.
 *
 * A toast closes after `expireMs`, 5000 by default, or stays until it is
 * closed when `expireMs` is `null`. Up to three toasts show at once, stacked
 * with the newest in front; hovering or focusing the stack spreads it out.
 */
const meta: Meta = {
  title: "Design System/Feedback/Toast",
  tags: ["updated", "unreviewed", "incomplete"],
  component: Toast,
  subcomponents: { ToastRegion },
  parameters: {
    controls: { disable: true },
  },
};

export default meta;

type Story = StoryObj;

const TOAST_WIDTH = 400;
const STAGE_WIDTH = 432;

const DATASET_CREATED = {
  title: "Dataset created",
  message: 'Dataset "support-tickets" created successfully',
};

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <HeldToast
      width={TOAST_WIDTH}
      hook="useNotifySuccess"
      {...DATASET_CREATED}
    />
  ),
};

const HOOKS: {
  label: NotifyHook;
  code: true;
  content: Omit<NotificationHookParams, "expireMs" | "action">;
  actionText: string;
}[] = [
  {
    label: "useNotify",
    code: true,
    content: {
      title: "Experiment stopped",
      message: "The experiment has been stopped.",
    },
    actionText: "View Experiment",
  },
  {
    label: "useNotifySuccess",
    code: true,
    content: DATASET_CREATED,
    actionText: "Go to Dataset",
  },
  {
    label: "useNotifyError",
    code: true,
    content: {
      title: "Failed to update baseline",
      message: "The experiment could not be found.",
    },
    actionText: "Retry",
  },
];

const CONTENT = [{ label: "Title and message" }, { label: "With action" }];

export const Variants: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={HOOKS}
      columns={CONTENT}
      renderCell={(hook, content) => (
        <HeldToast
          width={360}
          hook={hook.label}
          {...hook.content}
          action={
            content?.label === "With action"
              ? { text: hook.actionText, onClick: () => {} }
              : undefined
          }
        />
      )}
    />
  ),
};

const LENGTHS: {
  label: string;
  content: Omit<NotificationHookParams, "expireMs">;
}[] = [
  {
    label: "Title only",
    content: { title: "Experiment stopped" },
  },
  {
    label: "Title and message",
    content: {
      title: "Experiment stopped",
      message: "The experiment has been stopped.",
    },
  },
  {
    label: "Long",
    content: {
      title: "Traces now use trace-level filters",
      message:
        "The span-level filter from this link still applies on the Spans tab.",
    },
  },
];

export const ContentLength: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={LENGTHS}
      renderCell={(length) => (
        <HeldToast width={300} hook="useNotify" {...length.content} />
      )}
    />
  ),
};

function useVisibleToastCount() {
  const queue = useToastQueue();
  return useSyncExternalStore(
    (onChange) => queue.subscribe(onChange),
    () => queue.visibleToasts.length
  );
}

function AddToastButton() {
  const { useNotifySuccess: notifySuccess } = useNotifiers();
  return (
    <Button
      size="S"
      onPress={() =>
        notifySuccess({
          title: "Copied",
          message: "The experiment ID has been copied to your clipboard",
          expireMs: null,
        })
      }
    >
      Add toast
    </Button>
  );
}

/**
 * Four toasts, raised oldest first. Only the three newest show; the oldest
 * waits in the queue until one of them is closed.
 */
export const Stack: Story = {
  tags: ["!dev"],
  render: () => (
    <ToastStage width={STAGE_WIDTH} height={260}>
      <ToastOnMount
        hook="useNotifyError"
        title="Failed to update baseline"
        message="The experiment could not be found."
      />
      <ToastOnMount hook="useNotifySuccess" {...DATASET_CREATED} />
      <ToastOnMount
        hook="useNotify"
        title="Experiment stopped"
        message="The experiment has been stopped."
      />
      <ToastOnMount
        hook="useNotifySuccess"
        title="Split created"
        message='Created split "train"'
      />
      <AddToastButton />
    </ToastStage>
  ),
};

function ShowActionToastButton(params: NotificationHookParams) {
  const { useNotifySuccess: notifySuccess } = useNotifiers();
  const isVisible = useVisibleToastCount() > 0;
  return (
    <Button
      size="S"
      isDisabled={isVisible}
      onPress={() => notifySuccess({ ...params, expireMs: null })}
    >
      Show toast
    </Button>
  );
}

const ACTIONS: {
  label: string;
  code: true;
  action: NotificationHookParams["action"];
}[] = [
  {
    label: "closeOnClick omitted",
    code: true,
    action: { text: "Go to Dataset", onClick: () => {} },
  },
  {
    label: "closeOnClick: false",
    code: true,
    action: {
      text: "Go to Dataset",
      closeOnClick: false,
      onClick: (close) => {
        setTimeout(close, 1000);
      },
    },
  },
  {
    label: "element",
    code: true,
    action: <Link to="/datasets">Go to Dataset</Link>,
  },
];

/**
 * An `action` object renders a button that closes the toast when pressed.
 * With `closeOnClick: false` the toast stays until the handler calls the
 * `close` it receives, here one second after the press. An element is
 * rendered as given, and only the close button closes the toast.
 */
export const Action: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={ACTIONS}
      renderCell={({ action }) => (
        <ToastStage width={STAGE_WIDTH} height={140} direction="row">
          <ShowActionToastButton {...DATASET_CREATED} action={action} />
        </ToastStage>
      )}
    />
  ),
};

type Lifetime = { key: string; shownAt: number; closedAt?: number };

function formatSeconds(ms: number) {
  return `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
}

/** How long the stage's latest toast has been, or was, visible. */
function ToastLifetime() {
  const queue = useToastQueue();
  const [lifetimes, setLifetimes] = useState<Lifetime[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(
    () =>
      queue.subscribe(() => {
        const time = Date.now();
        const visibleKeys = new Set(queue.visibleToasts.map((t) => t.key));
        setLifetimes((previous) => {
          const next = previous.map((lifetime) =>
            lifetime.closedAt === undefined && !visibleKeys.has(lifetime.key)
              ? { ...lifetime, closedAt: time }
              : lifetime
          );
          visibleKeys.forEach((key) => {
            if (!previous.some((lifetime) => lifetime.key === key)) {
              next.push({ key, shownAt: time });
            }
          });
          return next;
        });
      }),
    [queue]
  );
  const latest = lifetimes.at(-1);
  const isOpen = latest !== undefined && latest.closedAt === undefined;
  useEffect(() => {
    const interval = isOpen
      ? setInterval(() => setNow(Date.now()), 100)
      : undefined;
    return () => clearInterval(interval);
  }, [isOpen]);
  let status = "Not shown yet";
  if (latest?.closedAt !== undefined) {
    status = `Closed after ${formatSeconds(latest.closedAt - latest.shownAt)}`;
  } else if (latest) {
    status = `Visible for ${formatSeconds(now - latest.shownAt)}`;
  }
  return (
    <Text size="S" color="text-700" fontFamily="mono">
      {status}
    </Text>
  );
}

function ShowToastButton({ expireMs }: { expireMs?: number | null }) {
  const { useNotifySuccess: notifySuccess } = useNotifiers();
  const isVisible = useVisibleToastCount() > 0;
  return (
    <Button
      size="S"
      isDisabled={isVisible}
      onPress={() => notifySuccess({ ...DATASET_CREATED, expireMs })}
    >
      Show toast
    </Button>
  );
}

const EXPIRATIONS: {
  label: string;
  code: true;
  expireMs?: number | null;
}[] = [
  { label: "1000", code: true, expireMs: 1000 },
  { label: "3000", code: true, expireMs: 3000 },
  { label: "omitted (5000)", code: true },
  { label: "null", code: true, expireMs: null },
];

/**
 * Rows are `expireMs` values. A toast's timer starts when it becomes
 * visible, so one queued behind three others keeps its full time. While
 * the region is hovered or focused, every visible toast's timer pauses and
 * then resumes with the time it had left, so a toast held under the
 * pointer stays up longer than its `expireMs`; the readout beside each
 * stage shows how long it was actually visible.
 */
export const Expiration: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={EXPIRATIONS}
      renderCell={({ expireMs }) => (
        <ToastStage width={STAGE_WIDTH} height={116} direction="row">
          <Flex alignItems="center" gap="size-150">
            <ShowToastButton expireMs={expireMs} />
            <ToastLifetime />
          </Flex>
        </ToastStage>
      )}
    />
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  ...Default,
  tags: ["!dev", "!autodocs"],
  parameters: { thumbnail: { scale: 0.75 } },
};
