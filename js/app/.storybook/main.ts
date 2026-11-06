import { resolve } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  // Recursive: stories live in directories mirroring their title.
  // `stories/_meta` and `stories/constants|utils` hold helpers, not stories,
  // and are not matched because they contain no `*.stories.*` or `*.mdx`.
  // @see app/stories/_meta/taxonomy.ts
  stories: [
    "../stories/**/*.mdx",
    "../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  core: {
    disableWhatsNewNotifications: true,
  },
  // `@storybook/addon-vitest` is installed but deliberately not registered:
  // no Vitest project runs stories (vite.config.mts has no `storybookTest`
  // plugin), so its "Run tests" sidebar widget had nothing to run.
  addons: ["@storybook/addon-docs", "@storybook/addon-designs"],
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
    });
  },
};
export default config;
