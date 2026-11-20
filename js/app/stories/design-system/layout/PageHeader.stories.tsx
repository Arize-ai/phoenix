import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { PageHeaderProps, TagGroupItem } from "@phoenix/components";
import {
  Button,
  EditableTagGroup,
  Flex,
  Heading,
  PageHeader,
  TagGroup,
  TagPicker,
  Text,
  Truncate,
  View,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * The title row at the top of a page, with an optional subtitle beneath the
 * title, the subject's labels on their own row beneath that, and page-level
 * actions in `extra` at the right.
 *
 * `labels` takes an `EditableTagGroup` where the person can edit the labels
 * (each change saves at once, as on the dataset and prompt pages), or a
 * read-only `TagGroup`. Labels never sit in the title row.
 *
 * A string `title` renders as the page's level 1 heading and a string
 * `subTitle` as secondary text. Any other node renders as given, so a title
 * that adds truncation has to supply its own `Heading level={1}`.
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

const LABELS: TagGroupItem[] = [
  { id: "production", label: "production", userColor: "#33c5e8" },
  { id: "banking", label: "banking", userColor: "#ffa037" },
  { id: "needs-review", label: "needs-review", userColor: "#ff95bd" },
];

const SLOTS: { label: string; props: PageHeaderProps }[] = [
  { label: "Bare", props: { title: "Playground" } },
  {
    label: "Subtitle",
    props: { title: "Datasets", subTitle: "Curated examples for experiments" },
  },
  { label: "Extra", props: { title: "Playground", extra: PLAYGROUND_ACTIONS } },
  {
    label: "Labels",
    props: {
      title: "qa-golden-set",
      labels: <TagGroup aria-label="Dataset labels" items={LABELS} />,
    },
  },
  {
    label: "Every slot",
    props: {
      title: "qa-golden-set",
      subTitle: "Questions with reference answers",
      labels: <TagGroup aria-label="Dataset labels" items={LABELS} />,
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

function EditableHeaderLabels({ initialIds }: { initialIds: string[] }) {
  const [ids, setIds] = useState(initialIds);
  return (
    <EditableTagGroup
      aria-label="Dataset labels"
      items={LABELS.filter((item) => ids.includes(item.id))}
      onRemove={(removed) => setIds(ids.filter((id) => !removed.has(id)))}
      picker={
        <TagPicker
          options={LABELS}
          selectedKeys={ids}
          onSelectionChange={(selected) => setIds([...selected])}
        />
      }
    />
  );
}

const EDITABLE_LABELS: { label: string; initialIds: string[] }[] = [
  { label: "Labeled", initialIds: ["production", "banking"] },
  { label: "No labels", initialIds: [] },
];

/**
 * The labels row with an `EditableTagGroup`, as on the dataset and prompt
 * pages: remove a label with its × or Delete, add one from the picker.
 * Without labels the row reads "No labels" beside the add control.
 */
export const EditableLabels: StoryFn = () => (
  <OptionGrid
    rows={EDITABLE_LABELS}
    renderCell={(row) => (
      <Frame>
        <PageHeader
          title="banking_saas_dataset"
          subTitle="banking_saas_dataset.jsonl"
          labels={<EditableHeaderLabels initialIds={row.initialIds} />}
          extra={<Button variant="primary">Experiment</Button>}
        />
      </Frame>
    )}
  />
);
EditableLabels.storyName = "Editable Labels";
EditableLabels.tags = ["!dev"];
EditableLabels.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ width: "100%" }}>
      <PageHeader
        title="Datasets"
        subTitle="Curated examples"
        labels={<TagGroup aria-label="Labels" items={LABELS.slice(0, 2)} />}
        extra={<Button variant="primary">New</Button>}
      />
    </div>
  ),
};
