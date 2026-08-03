import type { Meta, StoryFn } from "@storybook/react";

import { View } from "@phoenix/components";
import { AISearchSettingsCard } from "@phoenix/components/filter";
import { PreferencesProvider } from "@phoenix/contexts";
import { CredentialsProvider } from "@phoenix/contexts/CredentialsContext";

import { AISearchRelayEnvironment } from "./utils/aiSearchRelayEnvironment";

/**
 * The AI search configuration as a settings card — the same form the filter
 * field's gear popover shows, as it appears on the profile's Generative AI
 * page. Every surface reads and writes the same persisted preference.
 */
const meta: Meta<typeof AISearchSettingsCard> = {
  title: "Filter/AISearchSettingsCard",
  component: AISearchSettingsCard,
  decorators: [
    // The model picker loads providers over Relay; the stories answer it
    // with a canned catalog
    (Story) => (
      <AISearchRelayEnvironment>
        <Story />
      </AISearchRelayEnvironment>
    ),
  ],
};

export default meta;

/**
 * The feature switch and, once enabled, the model picker: Browser AI — the
 * on-device built-in model (availability reflects the browser viewing the
 * story) — alongside providers called with credentials held only in this
 * browser. Changes persist in this browser's storage.
 */
export const Default: StoryFn = () => (
  <CredentialsProvider>
    <View width="600px">
      <AISearchSettingsCard />
    </View>
  </CredentialsProvider>
);

/**
 * Seeded with AI search enabled so the model choice renders without
 * flipping the switch first.
 */
export const Enabled: StoryFn = () => (
  <PreferencesProvider isAISearchEnabled>
    <CredentialsProvider>
      <View width="600px">
        <AISearchSettingsCard />
      </View>
    </CredentialsProvider>
  </PreferencesProvider>
);
