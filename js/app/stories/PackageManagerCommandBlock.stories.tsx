import type { Meta, StoryObj } from "@storybook/react";

import { View } from "@phoenix/components";
import { PackageManagerCommandBlock } from "@phoenix/components/code";

const meta: Meta<typeof PackageManagerCommandBlock> = {
  title: "Code/PackageManagerCommandBlock",
  component: PackageManagerCommandBlock,
  parameters: {
    layout: "centered",
  },
  args: {
    language: "TypeScript",
    packages: ["@arizeai/phoenix-otel"],
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const TypeScript: Story = {
  args: {
    language: "Python",
    packages: ["@arizeai/phoenix-otel"],
  },
  render: (args) => {
    const language = args.language ?? "TypeScript";
    const packages = args.packages ?? ["@arizeai/phoenix-otel"];
    return (
      <View width="900px" padding="size-200">
        <PackageManagerCommandBlock
          language={language}
          packages={packages}
          className={args.className}
        />
      </View>
    );
  },
};

export const Python: Story = {
  args: {
    language: "Python",
    packages: ["arize-phoenix-otel"],
  },
  render: (args) => {
    const language = args.language ?? "Python";
    const packages = args.packages ?? ["arize-phoenix-otel"];
    return (
      <View width="900px" padding="size-200">
        <PackageManagerCommandBlock
          language={language}
          packages={packages}
          className={args.className}
        />
      </View>
    );
  },
};
