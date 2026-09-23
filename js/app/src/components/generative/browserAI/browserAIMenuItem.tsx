import { Icon, Icons } from "@phoenix/components";
import type { ModelMenuLeadingItem } from "@phoenix/components/generative/ModelMenu";

import {
  getBrowserBuiltInModel,
  useBrowserModelAvailability,
} from "./browserModel";
import { StatusText } from "./StatusText";

/**
 * Identifies the Browser AI entry among the model picker's leading items.
 */
export const BROWSER_AI_MENU_ITEM_ID = "browser-ai";

/**
 * Availability of the on-device model as a short dot-status, shown beside
 * the Browser AI entry in the picker and under the picker when Browser AI
 * is selected. With `warningOnly` the healthy states render nothing — the
 * compact settings dropdown stays quiet unless the model can't run here.
 */
export function BrowserModelAvailabilityStatus({
  warningOnly = false,
}: {
  warningOnly?: boolean;
}) {
  const availability = useBrowserModelAvailability();
  if (availability === null) {
    return null;
  }
  switch (availability) {
    case "available":
      return warningOnly ? null : <StatusText tone="success">Ready</StatusText>;
    case "needs-download":
      return warningOnly ? null : (
        <StatusText>Downloads on first use</StatusText>
      );
    case "downloading":
      return warningOnly ? null : <StatusText>Downloading…</StatusText>;
    default:
      return (
        <StatusText tone="warning">Not supported in this browser</StatusText>
      );
  }
}

/**
 * The model picker entry for Browser AI — the browser's built-in on-device
 * model — or null in browsers without one, where the picker simply doesn't
 * offer it. A plugin for the generic ModelMenu's `leadingItems` extension
 * point; the menu itself knows nothing about Browser AI.
 *
 * The entry is labeled with the model the browser actually runs (e.g.
 * "Gemini Nano" in Chrome) rather than the category name, so it reads like
 * every other row in the picker — each of which names a model, not a way of
 * reaching one. The globe icon carries the on-device distinction.
 */
export function useBrowserAIMenuItem(): ModelMenuLeadingItem | null {
  const availability = useBrowserModelAvailability();
  const builtInModel = getBrowserBuiltInModel();
  if (builtInModel === null) {
    return null;
  }
  return {
    id: BROWSER_AI_MENU_ITEM_ID,
    label: builtInModel.modelName,
    icon: <Icon svg={<Icons.Globe />} />,
    trailing: <BrowserModelAvailabilityStatus />,
    // The Prompt API exists but no model can be provisioned on this device
    // (unsupported hardware, low disk) — listed so the option is
    // discoverable, but not selectable
    isDisabled: availability === "unavailable",
  };
}
