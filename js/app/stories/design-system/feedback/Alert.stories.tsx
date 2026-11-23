import type { Meta, StoryFn } from "@storybook/react";

import { Alert, Icon, Icons, LinkButton } from "@phoenix/components";
import type { SeverityLevel } from "@phoenix/components/core/types";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A message about the state of the surface it sits in. Choose the variant
 * from what the message means:
 *
 * - **info** — neutral or contextual information: tips, onboarding hints,
 *   notices about the session
 * - **success** — a completed action or saved change
 * - **warning** — a degraded state, an approaching limit, or a non-blocking
 *   issue
 * - **danger** — a failed operation or a blocking error
 *
 * Set `banner` when the alert spans the full width of a dialog or page, directly
 * under its header: it drops the rounded corners and side borders so it meets
 * the edges.
 */
const meta: Meta = {
  title: "Design System/Feedback/Alert",
  component: Alert,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    controls: { disable: true },
  },
};

export default meta;

const VARIANTS: { label: SeverityLevel; code: true; message: string }[] = [
  {
    label: "info",
    code: true,
    message:
      "This session is responding in another window. The chat will refresh when it completes.",
  },
  { label: "success", code: true, message: "Password has been reset." },
  { label: "warning", code: true, message: "Disabled by system settings." },
  {
    label: "danger",
    code: true,
    message: "Failed to create dataset. Please try again.",
  },
];

const MESSAGE = "The chat has been refreshed with the latest messages.";

const SLOTS: {
  label: string;
  title?: string;
  icon?: boolean;
  showIcon?: boolean;
  extra?: boolean;
  dismissable?: boolean;
}[] = [
  { label: "Bare" },
  { label: "Title", title: "Session updated elsewhere" },
  { label: "Custom icon", icon: true },
  { label: "No icon", showIcon: false },
  { label: "Extra", extra: true },
  { label: "Dismissable", dismissable: true },
];

const LENGTHS: { label: string; title?: string; message: string }[] = [
  { label: "Empty", message: "" },
  { label: "1 character", message: "!" },
  { label: "Regular", message: "Disabled by system settings." },
  {
    label: "Long message",
    message:
      "This session was switched to claude-sonnet-4-5 in another window. Your unsent message is still in the input below, and will be sent with the new model.",
  },
  {
    label: "Long title",
    title:
      "Evaluator Error: correctness-with-reference-and-rubric-for-long-answers",
    message: "The evaluator returned an invalid score.",
  },
];

export const Default: StoryFn = () => (
  <Alert variant="info" title="Session in use elsewhere">
    This session is responding in another window. The chat will refresh when it
    completes.
  </Alert>
);
Default.tags = ["!dev"];

export const Variants: StoryFn = () => (
  <OptionGrid
    rows={VARIANTS}
    cellWidth="320px"
    justifyCells="stretch"
    renderCell={(variant) => (
      <Alert variant={variant.label}>{variant.message}</Alert>
    )}
  />
);
Variants.tags = ["!dev"];
Variants.parameters = { themeLayout: "row" };

export const Slots: StoryFn = () => (
  <OptionGrid
    rows={SLOTS}
    cellWidth="320px"
    justifyCells="stretch"
    renderCell={(slot) => (
      <Alert
        variant="info"
        title={slot.title}
        icon={slot.icon ? <Icon svg={<Icons.Lock />} /> : undefined}
        showIcon={slot.showIcon}
        extra={
          slot.extra ? (
            <LinkButton size="S" to="/settings/agents">
              Settings
            </LinkButton>
          ) : undefined
        }
        dismissable={slot.dismissable}
        onDismissClick={() => {}}
      >
        {MESSAGE}
      </Alert>
    )}
  />
);
Slots.tags = ["!dev"];
Slots.parameters = { themeLayout: "row" };

export const Composition: StoryFn = () => (
  <OptionGrid
    rows={[{ label: "Title and dismiss" }, { label: "Custom icon and extra" }]}
    cellWidth="480px"
    justifyCells="stretch"
    renderCell={(row) =>
      row.label === "Title and dismiss" ? (
        <Alert
          variant="info"
          title="Model changed elsewhere"
          dismissable
          onDismissClick={() => {}}
        >
          This session was switched to claude-sonnet-4-5 in another window. Your
          unsent message is still in the input below.
        </Alert>
      ) : (
        <Alert
          variant="warning"
          icon={<Icon svg={<Icons.Lock />} />}
          extra={
            <LinkButton size="S" to="/settings/agents">
              Assistant settings
            </LinkButton>
          }
        >
          Disabled by system settings.
        </Alert>
      )
    }
  />
);
Composition.tags = ["!dev"];
Composition.parameters = { themeLayout: "column" };

export const Banner: StoryFn = () => (
  <Alert
    variant="danger"
    title="Session could not be deleted"
    banner
    dismissable
    onDismissClick={() => {}}
  >
    The session is still responding. Wait for it to finish, then try again.
  </Alert>
);
Banner.tags = ["!dev"];
Banner.parameters = {
  inset: false,
  width: "fill",
  themeLayout: "column",
};

export const ContentLength: StoryFn = () => (
  <OptionGrid
    rows={LENGTHS}
    cellWidth="320px"
    justifyCells="stretch"
    renderCell={(length) => (
      <Alert variant="info" title={length.title}>
        {length.message}
      </Alert>
    )}
  />
);
ContentLength.tags = ["!dev"];
ContentLength.parameters = { themeLayout: "row" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryFn = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 12,
      width: "100%",
    }}
  >
    <Alert variant="info" title="Alert Title">
      This is an alert with a title
    </Alert>
    <Alert variant="danger">This is a danger alert</Alert>
  </div>
);
Thumbnail.tags = ["!dev", "!autodocs"];
