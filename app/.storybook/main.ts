import { resolve } from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
  stories: ["../stories/*.mdx", "../stories/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@chromatic-com/storybook",
    "@storybook/addon-interactions",
    "@storybook/addon-designs",
    "react-docgen-typescript",
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
        include: ["@storybook/addon-interactions", "@emotion/react"],
      },
      resolve: {
        alias: {
          "@phoenix": resolve(__dirname, "../src"),
        },
      },
    });
  },
};
export default config;
