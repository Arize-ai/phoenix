import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { View } from "@phoenix/components";
import {
  AIQuerySettingsCard,
  BrowserModelCard,
} from "@phoenix/components/filter";
import { PreferencesProvider } from "@phoenix/contexts";
import { CredentialsProvider } from "@phoenix/contexts/CredentialsContext";
import { ProfileGenerativeAIPage } from "@phoenix/pages/profile/ProfileGenerativeAIPage";

import { AIQueryRelayEnvironment } from "../../utils/aiQueryRelayEnvironment";

/**
 * The profile's Generative AI page, which stacks two cards that are always
 * seen together:
 *
 * - **AI query settings** — the same form the filter field's gear popover
 *   shows. Every surface reads and writes the same persisted preference. (The
 *   Settings page's AI providers tab also renders this card on its own.)
 * - **Browser model** — management of the browser's built-in on-device
 *   model: download status and progress, a way to download ahead of first
 *   use, and how to remove the model.
 *
 * "Page" renders the shipped page; the remaining stories isolate each card
 * in the states a preference can seed.
 */
const meta: Meta<typeof ProfileGenerativeAIPage> = {
  title: "Domains/Settings/Generative AI",
  tags: ["updated", "unreviewed", "incomplete"],
  component: ProfileGenerativeAIPage,
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
 * The page as it renders in the profile's Generative AI tab, at that tab
 * panel's maximum width: the AI query card above the browser model card.
 * Changes persist in this browser's storage, and the browser model card
 * reflects the browser viewing the story.
 */
export const Page: StoryFn = () => (
  <CredentialsProvider>
    <View width="800px">
      <ProfileGenerativeAIPage />
    </View>
  </CredentialsProvider>
);

/**
 * The feature switch and, once enabled, the model picker: Browser AI — the
 * on-device built-in model (availability reflects the browser viewing the
 * story) — alongside providers called through the Phoenix server with
 * credentials configured there. Changes persist in this browser's storage.
 */
export const AIQuerySettings: StoryFn = () => (
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
export const AIQuerySettingsEnabled: StoryFn = () => (
  <PreferencesProvider isAIQueryEnabled>
    <CredentialsProvider>
      <View width="600px">
        <AIQuerySettingsCard />
      </View>
    </CredentialsProvider>
  </PreferencesProvider>
);

/**
 * The card reflects the real Prompt API state of the browser viewing the
 * story: Chrome shows Gemini Nano's actual availability (not downloaded,
 * downloading with progress, or ready), Edge shows Phi, and other browsers
 * the unsupported explanation. Note the download button starts a real
 * multi-gigabyte browser-managed download.
 */
export const BrowserModel: StoryFn = () => (
  <View width="600px">
    <BrowserModelCard />
  </View>
);

/**
 * Seeded with AI query already enabled and pointed at the browser model,
 * so the usage line reads that filter fields use this model instead of
 * "Not in use".
 */
export const BrowserModelEnabledForAIQuery: StoryFn = () => (
  <PreferencesProvider
    isAIQueryEnabled
    aiQueryModelConfig={{ kind: "browser" }}
  >
    <View width="600px">
      <BrowserModelCard />
    </View>
  </PreferencesProvider>
);

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  // A full-width settings card.
  parameters: { thumbnail: { scale: 0.5 } },
  render: AIQuerySettingsEnabled,
};
