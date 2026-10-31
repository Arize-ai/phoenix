import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import type { PageHeaderLabel, PageHeaderProps } from "@phoenix/components";
import {
  Button,
  Flex,
  Heading,
  Icon,
  IconButton,
  Icons,
  Link,
  PageHeader,
  Text,
  Truncate,
  View,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * The header at the top of a page. The title, with an optional caption
 * directly beneath it, and the page-level actions in `extra` share the first
 * row, centered on each other. Beneath them, across the full width, come the
 * subject's description and the labels row. The labels row starts with the
 * label editing control in `labelAction`; when that control is set and there
 * are no labels, the row reads "No labels". Labels wrap beneath the control.
 *
 * A string `title` renders as the page's level 1 heading, and a string
 * `subTitle` or `caption` as secondary text. Any other node renders as given,
 * so a title that adds truncation has to supply its own `Heading level={1}`.
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

const PROMPT_ACTIONS = (
  <Flex direction="row" gap="size-100" alignItems="center">
    <Button>Clone</Button>
    <Button variant="primary">Playground</Button>
  </Flex>
);

const LABELS: PageHeaderLabel[] = [
  { id: "1", name: "production", color: "var(--global-color-seafoam-600)" },
  { id: "2", name: "billing", color: "var(--global-color-yellow-600)" },
];

const DESCRIPTION = "Answers billing and account questions for the help center";

const LABEL_ACTION = (
  <IconButton size="S" aria-label="Edit prompt labels">
    <Icon svg={<Icons.PriceTags />} />
  </IconButton>
);

const CLONED_FROM = (
  <Text size="XS" color="text-700">
    cloned from <Link to="/prompts/1">support-agent-v1</Link>
  </Text>
);

const SLOTS: { label: string; props: PageHeaderProps }[] = [
  { label: "Bare", props: { title: "support-agent" } },
  { label: "Labels", props: { title: "support-agent", labels: LABELS } },
  {
    label: "Label action",
    props: { title: "support-agent", labelAction: LABEL_ACTION },
  },
  {
    label: "Subtitle",
    props: { title: "support-agent", subTitle: DESCRIPTION },
  },
  {
    label: "Caption",
    props: { title: "support-agent", caption: CLONED_FROM },
  },
  {
    label: "Extra",
    props: { title: "support-agent", extra: PROMPT_ACTIONS },
  },
  {
    label: "Labels and subtitle",
    props: { title: "support-agent", labels: LABELS, subTitle: DESCRIPTION },
  },
  {
    label: "Subtitle and caption",
    props: {
      title: "support-agent",
      subTitle: DESCRIPTION,
      caption: CLONED_FROM,
    },
  },
  {
    label: "Every slot",
    props: {
      title: "support-agent",
      labels: LABELS,
      labelAction: LABEL_ACTION,
      subTitle: DESCRIPTION,
      caption: CLONED_FROM,
      extra: PROMPT_ACTIONS,
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

const LABEL_COUNTS: { label: string; labels: PageHeaderLabel[] }[] = [
  { label: "One", labels: LABELS.slice(0, 1) },
  { label: "Two", labels: LABELS },
  {
    label: "Long name",
    labels: [
      {
        id: "3",
        name: "customer-support-escalations-and-refunds",
        color: "var(--global-color-purple-600)",
      },
    ],
  },
  {
    label: "Six",
    labels: [
      ...LABELS,
      { id: "4", name: "agent", color: "var(--global-color-blue-600)" },
      { id: "5", name: "gpt-4o", color: "var(--global-color-orange-600)" },
      { id: "6", name: "staging", color: "var(--global-color-red-600)" },
      { id: "7", name: "experimental" },
    ],
  },
  {
    label: "14 labels",
    labels: [
      ...LABELS,
      { id: "4", name: "agent", color: "var(--global-color-blue-600)" },
      { id: "5", name: "gpt-4o", color: "var(--global-color-orange-600)" },
      { id: "6", name: "staging", color: "var(--global-color-red-600)" },
      { id: "7", name: "experimental" },
      { id: "8", name: "rag", color: "var(--global-color-purple-600)" },
      { id: "9", name: "eu-region", color: "var(--global-color-seafoam-600)" },
      { id: "10", name: "tier-1", color: "var(--global-color-yellow-600)" },
      { id: "11", name: "escalations", color: "var(--global-color-blue-600)" },
      { id: "12", name: "refunds", color: "var(--global-color-orange-600)" },
      { id: "13", name: "voice", color: "var(--global-color-red-600)" },
      { id: "14", name: "deprecated" },
      { id: "15", name: "owner:support-team" },
    ],
  },
];

export const LabelContentLength: StoryFn = () => (
  <OptionGrid
    rows={LABEL_COUNTS}
    renderCell={(row) => (
      <Frame>
        <PageHeader
          title="support-agent"
          labels={row.labels}
          labelAction={LABEL_ACTION}
          caption={CLONED_FROM}
          subTitle={DESCRIPTION}
          extra={PROMPT_ACTIONS}
        />
      </Frame>
    )}
  />
);
LabelContentLength.storyName = "Label Content Length";
LabelContentLength.tags = ["!dev"];
LabelContentLength.parameters = { themeLayout: "column" };

const EVALUATOR_TITLE =
  "Evaluator: answer faithfulness to retrieved context for customer support";

const TITLE_CONTENT: { label: string; props: PageHeaderProps }[] = [
  { label: "String", props: { title: "qa-golden-set" } },
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
