import { createRequire } from "node:module";

import type { Plugin } from "./oxlintTypes.js";
import { guidanceRule } from "./rules/guidance.js";

const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const plugin: Plugin = {
  meta: { name: "jev", version },
  rules: {
    guidance: guidanceRule,
  },
};

export default plugin;
export { CHECKS } from "./checks.js";
export type { Check, CheckOptions, Finding } from "./checks.js";
export { TARGET_PACKAGE_PATTERN } from "./extract.js";
