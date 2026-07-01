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
    "@chromatic-com/storybook",
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
          output: {
            manualChunks(id) {
              if (
                id.includes("/node_modules/.pnpm/shiki@") ||
                id.includes("/node_modules/.pnpm/@shikijs+") ||
                id.includes("/node_modules/.pnpm/@streamdown+code@") ||
                id.includes("/node_modules/.pnpm/streamdown@")
              ) {
                return "streamdown-shiki";
              }
            },
          },
        },
      },
    });
  },
};
export default config;
