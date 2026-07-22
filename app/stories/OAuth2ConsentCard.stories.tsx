import type { Meta, StoryObj } from "@storybook/react";

import { AuthCard } from "@phoenix/pages/auth/AuthLayout";
import { OAuth2ConsentCard } from "@phoenix/pages/auth/OAuth2ConsentCard";

/**
 * The OAuth2 consent ("handoff") card shown when an application asks for
 * access to the user's Phoenix workspace, framed in the auth page card.
 */
const meta: Meta<typeof OAuth2ConsentCard> = {
  title: "Auth/OAuth2ConsentCard",
  component: OAuth2ConsentCard,
  parameters: {
    layout: "centered",
    controls: { expanded: true },
  },
  args: {
    clientName: "Phoenix CLI",
    clientId: "phoenix-cli",
    signedInAs: "testuser@arize.com",
    isFirstParty: true,
    redirectUri: "http://127.0.0.1:50616/callback",
    errorMessage: null,
    isMissingRequiredParams: false,
    isSubmitting: false,
    onApprove: () => {},
    onCancel: () => {},
  },
  decorators: [
    (Story) => (
      <AuthCard>
        <Story />
      </AuthCard>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof OAuth2ConsentCard>;

/**
 * First-party CLI login over a loopback redirect — the common
 * `px auth login` handoff.
 */
export const Default: Story = {};

/**
 * A third-party client registered via dynamic client registration,
 * redirecting to a hosted https callback.
 */
export const UnverifiedThirdParty: Story = {
  args: {
    clientName: "Acme Dashboards",
    clientId: "px_dcr_abc1234567890",
    isFirstParty: false,
    redirectUri: "https://dashboards.acme.dev/oauth/callback",
  },
};

/**
 * A third-party client using a private-use URI scheme — an app installed
 * on the user's device (e.g. an IDE).
 */
export const PrivateUseRedirect: Story = {
  args: {
    clientName: "Cursor",
    clientId: "px_dcr_9f8e7d6c5b4a",
    isFirstParty: false,
    redirectUri: "cursor://anysphere.cursor-mcp/oauth/callback",
  },
};

/**
 * The authorization decision failed server-side.
 */
export const WithError: Story = {
  args: {
    errorMessage: "Phoenix could not complete this authorization request.",
  },
};

/**
 * The authorize URL is malformed — required parameters are missing, so the
 * actions are disabled.
 */
export const MissingRequiredParams: Story = {
  args: {
    redirectUri: null,
    isMissingRequiredParams: true,
  },
};

/**
 * A decision is in flight.
 */
export const Submitting: Story = {
  args: {
    isSubmitting: true,
  },
};
