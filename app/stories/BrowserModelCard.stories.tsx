import type { Meta, StoryFn } from "@storybook/react";

import { View } from "@phoenix/components";
import { BrowserModelCard } from "@phoenix/components/filter";
import { PreferencesProvider } from "@phoenix/contexts";

/**
 * Management surface for the browser's built-in on-device model, as shown
 * on the profile's Generative AI page: download status and progress, a way
 * to download ahead of first use, and how to remove the model.
 */
const meta: Meta<typeof BrowserModelCard> = {
  title: "Filter/BrowserModelCard",
  component: BrowserModelCard,
};

export default meta;

/**
 * The card reflects the real Prompt API state of the browser viewing the
 * story: Chrome shows Gemini Nano's actual availability (not downloaded,
 * downloading with progress, or ready), Edge shows Phi, and other browsers
 * the unsupported explanation. Note the download button starts a real
 * multi-gigabyte browser-managed download.
 */
export const Default: StoryFn = () => (
  <View width="600px">
    <BrowserModelCard />
  </View>
);

/**
 * Seeded with AI search already enabled and pointed at the browser model,
 * so the "used by" fact reads that filter fields use this model instead of
 * "Not in use".
 */
export const EnabledForAISearch: StoryFn = () => (
  <PreferencesProvider
    isAISearchEnabled
    aiSearchModelConfig={{ kind: "browser" }}
  >
    <View width="600px">
      <BrowserModelCard />
    </View>
  </PreferencesProvider>
);
