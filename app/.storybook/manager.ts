import { addons } from "@storybook/manager-api";

addons.setConfig({
  // Disable keyboard shortcuts globally to prevent interference with
  // input fields in stories (e.g., pressing "1" in a search field
  // would otherwise trigger Storybook's "Go to Canvas" shortcut)
  enableShortcuts: false,
});
