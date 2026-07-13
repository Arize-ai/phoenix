import { resolve } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../stories/*.mdx", "../stories/*.stories.@(js|jsx|mjs|ts|tsx)"],
  core: {
    disableWhatsNewNotifications: true,
  },
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-designs",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  async viteFinal(config, { configType: _configType }) {
    // return the customized config
    return mergeConfig(config, {
      // customize the Vite config here
      optimizeDeps: {
        include: ["@emotion/react"],
      },
      resolve: {
        alias: {
          "@phoenix": resolve(import.meta.dirname, "../src"),
        },
      },
      build: {
        rolldownOptions: {
          experimental: {
            // Rolldown's `lazyBarrel` optimization (on by default in the
            // rolldown 1.1.3 that vite 8.1.0 locks) miscompiles shiki's
            // deeply-nested `export *` re-export chains: emitted chunks call
            // the `__reExport` helper with no definition in scope, which
            // crashes the published Storybook build.
            // Shiki is pulled in via @streamdown/code and @pierre/diffs.
            // Remove once the lockfile resolves rolldown >= 1.1.4, which
            // turns the experiment off by default; see
            // https://github.com/rolldown/rolldown/issues/9806.
            lazyBarrel: false,
          },
        },
      },
    });
  },
};
export default config;
