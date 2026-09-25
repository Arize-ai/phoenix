import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { Flex, List, ListItem, Text, View } from "@phoenix/components";
import type { ListProps } from "@phoenix/components/core/list/types";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A static list of rows divided by rules, such as a sandbox's configured
 * settings or a prompt's model and provider. Its rows are not interactive.
 */
const meta: Meta = {
  title: "Design System/Layout/List",
  component: List,
  subcomponents: { ListItem },
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

type Row = { label: string; value: string };

const SANDBOX_CONFIG: Row[] = [
  { label: "Name", value: "python-default" },
  { label: "Timeout", value: "30 seconds" },
  { label: "Environment variables", value: "2 variables" },
  { label: "Internet access", value: "Disabled" },
  { label: "Dependencies", value: "numpy, pandas" },
];

const SIZES: { label: NonNullable<ListProps["size"]>; code: true }[] = [
  { label: "S", code: true },
  { label: "M", code: true },
];

const LENGTHS: { label: string; rows: Row[] }[] = [
  { label: "One row", rows: [{ label: "Model", value: "gpt-4o" }] },
  {
    label: "Regular",
    rows: [
      { label: "Model", value: "gpt-4o" },
      { label: "Provider", value: "OpenAI" },
      { label: "temperature", value: "0.7" },
    ],
  },
  {
    label: "Long value",
    rows: [
      { label: "Model", value: "gpt-4o" },
      {
        label: "Dependencies",
        value: "numpy, pandas, scikit-learn, sentence-transformers, tiktoken",
      },
    ],
  },
];

function ConfigList({
  rows,
  size = "M",
}: {
  rows: Row[];
  size?: ListProps["size"];
}) {
  return (
    <List size={size}>
      {rows.map((row) => (
        <ListItem key={row.label}>
          <View paddingStart="size-100" paddingEnd="size-100">
            <Flex direction="row" justifyContent="space-between" gap="size-200">
              <Text size="S" color="text-700">
                {row.label}
              </Text>
              <Text size="S">{row.value}</Text>
            </Flex>
          </View>
        </ListItem>
      ))}
    </List>
  );
}

export const Default: StoryFn = () => (
  <div style={{ width: 360 }}>
    <ConfigList rows={SANDBOX_CONFIG} />
  </div>
);
Default.tags = ["!dev"];

export const SizesAndContentLength: StoryFn = () => (
  <OptionGrid
    rows={SIZES}
    columns={LENGTHS}
    cellWidth="240px"
    alignRows="start"
    renderCell={(size, length) => (
      <div style={{ width: "100%" }}>
        <ConfigList rows={length?.rows ?? []} size={size.label} />
      </div>
    )}
  />
);
SizesAndContentLength.tags = ["!dev"];
SizesAndContentLength.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ width: 360 }}>
      <ConfigList rows={SANDBOX_CONFIG.slice(0, 4)} />
    </div>
  ),
};
