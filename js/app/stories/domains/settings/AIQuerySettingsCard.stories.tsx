import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { View } from "@phoenix/components";
import { AIQuerySettingsCard } from "@phoenix/components/filter";
import { PreferencesProvider } from "@phoenix/contexts";
import { CredentialsProvider } from "@phoenix/contexts/CredentialsContext";

import { AIQueryRelayEnvironment } from "../../utils/aiQueryRelayEnvironment";

/**
 * The AI query configuration as a settings card — the same form the filter
 * field's gear popover shows, as it appears on the profile's Generative AI
 * page. Every surface reads and writes the same persisted preference.
 */
const meta: Meta<typeof AIQuerySettingsCard> = {
  title: "Domains/Settings/AI Query Settings Card",
  tags: ["legacy", "unreviewed"],
  component: AIQuerySettingsCard,
  decorators: [
    // The model picker loads providers over Relay; the stories answer it
    // with a canned catalog
    (Story) => (
      <AIQueryRelayEnvironment>
        <Story />
      </AIQueryRelayEnvironment>
    ),
  ],
};

export default meta;

/**
 * The feature switch and, once enabled, the model picker: Browser AI — the
 * on-device built-in model (availability reflects the browser viewing the
 * story) — alongside providers called through the Phoenix server with
 * credentials configured there. Changes persist in this browser's storage.
 */
export const Default: StoryFn = () => (
  <CredentialsProvider>
    <View width="600px">
      <AIQuerySettingsCard />
    </View>
  </CredentialsProvider>
);

/**
 * Seeded with AI query enabled so the model choice renders without
 * flipping the switch first.
 */
export const Enabled: StoryFn = () => (
  <PreferencesProvider isAIQueryEnabled>
    <CredentialsProvider>
      <View width="600px">
        <AIQuerySettingsCard />
      </View>
    </CredentialsProvider>
  </PreferencesProvider>
);

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  // A full-width settings card.
  parameters: { thumbnail: { scale: 0.5 } },
  render: Enabled,
};
