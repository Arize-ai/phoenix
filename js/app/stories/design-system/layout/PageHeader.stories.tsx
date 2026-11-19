import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import type { PageHeaderProps } from "@phoenix/components";
import {
  Button,
  Flex,
  Heading,
  PageHeader,
  Text,
  Token,
  Truncate,
  View,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * The title row at the top of a page, with an optional subtitle beneath the
 * title and page-level actions in `extra` at the right.
 *
 * A string `title` renders as the page's level 1 heading and a string
 * `subTitle` as secondary text. Any other node renders as given, so a title
 * that adds labels or truncation has to supply its own `Heading level={1}`.
 */
const meta: Meta = {
  title: "Design System/Layout/Page Header",
  tags: ["updated", "unreviewed", "complete"],
  component: PageHeader,
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const Frame = ({ children }: { children: ReactNode }) => (
  <View
    width="560px"
    borderWidth="thin"
    borderColor="default"
    borderRadius="medium"
  >
    {children}
  </View>
);

export const Default: StoryFn = () => (
  <Frame>
    <PageHeader
      title="Support"
      subTitle="We are here to help. Pick a channel below to get in touch with us."
    />
  </Frame>
);
Default.tags = ["!dev"];
Default.parameters = { themeLayout: "column" };

const PLAYGROUND_ACTIONS = (
  <Flex direction="row" gap="size-100" alignItems="center">
    <Button>Config</Button>
    <Button variant="primary">Run</Button>
  </Flex>
);

const SLOTS: { label: string; props: PageHeaderProps }[] = [
  { label: "Bare", props: { title: "Playground" } },
  {
    label: "Subtitle",
    props: { title: "Datasets", subTitle: "Curated examples for experiments" },
  },
  { label: "Extra", props: { title: "Playground", extra: PLAYGROUND_ACTIONS } },
  {
    label: "Every slot",
    props: {
      title: "qa-golden-set",
      subTitle: "Questions with reference answers",
      extra: <Button variant="primary">Run Experiment</Button>,
    },
  },
];

export const Slots: StoryFn = () => (
  <OptionGrid
    rows={SLOTS}
    renderCell={(row) => (
      <Frame>
        <PageHeader {...row.props} />
      </Frame>
    )}
  />
);
Slots.tags = ["!dev"];
Slots.parameters = { themeLayout: "column" };

const EVALUATOR_TITLE =
  "Evaluator: answer faithfulness to retrieved context for customer support";

const TITLE_CONTENT: { label: string; props: PageHeaderProps }[] = [
  { label: "String", props: { title: "qa-golden-set", subTitle: "--" } },
  {
    label: "Heading with labels",
    props: {
      title: (
        <Flex direction="row" gap="size-100" alignItems="center">
          <Heading level={1}>qa-golden-set</Heading>
          <Token color="var(--global-color-seafoam-600)">production</Token>
          <Token color="var(--global-color-yellow-600)">v2</Token>
        </Flex>
      ),
      subTitle: "Questions with reference answers",
    },
  },
  {
    label: "Truncated heading",
    props: {
      title: (
        <Heading level={1}>
          <Truncate maxWidth="100%" title={EVALUATOR_TITLE}>
            {EVALUATOR_TITLE}
          </Truncate>
        </Heading>
      ),
      subTitle: "Checks that every claim is supported by a retrieved document",
      extra: <Button variant="primary">Edit</Button>,
    },
  },
  {
    label: "Subtitle node",
    props: {
      title: "support-agent",
      subTitle: <Text color="text-700">cloned from support-agent-v1</Text>,
    },
  },
];

export const TitleContent: StoryFn = () => (
  <OptionGrid
    rows={TITLE_CONTENT}
    renderCell={(row) => (
      <Frame>
        <PageHeader {...row.props} />
      </Frame>
    )}
  />
);
TitleContent.storyName = "Title Content";
TitleContent.tags = ["!dev"];
TitleContent.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ width: "100%" }}>
      <PageHeader
        title="Datasets"
        subTitle="Curated examples"
        extra={<Button variant="primary">New</Button>}
      />
    </div>
  ),
};
