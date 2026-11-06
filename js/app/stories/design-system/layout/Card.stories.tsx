import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import type { CardProps } from "@phoenix/components";
import {
  Button,
  Card,
  CardCollapsedPreview,
  Counter,
  Flex,
  OverflowRow,
  Text,
  Token,
  View,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A titled surface that groups related content. The header holds the title
 * and up to four optional slots: `subTitle` inline after the title,
 * `titleExtra` in the title's own run, `headerContent` in whatever width the
 * rest of the header leaves, and `extra` at the right edge.
 *
 * A `collapsible` card toggles from its header. When the title or header
 * content holds controls of its own, set `interactiveTitle` so the toggle is a
 * standalone arrow rather than a button wrapping them. A closed card can
 * excerpt its body with `CardCollapsedPreview`, passed as `headerContent`; it
 * shows only while its own card is closed.
 */
const meta: Meta = {
  title: "Design System/Layout/Card",
  tags: ["updated", "unreviewed", "incomplete"],
  component: Card,
  subcomponents: { CardCollapsedPreview },
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const CARD_WIDTH = "360px";

const Body = () => (
  <View padding="size-200">
    <Text>Correct answers cite the retrieved documents.</Text>
  </View>
);

export const Default: StoryFn = () => (
  <Card title="Evaluation criteria" width={CARD_WIDTH}>
    <Body />
  </Card>
);
Default.tags = ["!dev"];

const ANNOTATION_TOKENS = (
  <OverflowRow>
    <Token size="S">hallucination</Token>
    <Token size="S">correctness</Token>
    <Token size="S">relevance</Token>
    <Token size="S">toxicity</Token>
  </OverflowRow>
);

const SLOTS: { label: string; props: Partial<CardProps> }[] = [
  { label: "Bare", props: {} },
  { label: "Subtitle", props: { subTitle: "Scored by an LLM judge" } },
  {
    label: "Title extra",
    props: { titleExtra: <Counter variant="quiet">4</Counter> },
  },
  { label: "Header content", props: { headerContent: ANNOTATION_TOKENS } },
  { label: "Extra", props: { extra: <Button size="S">Edit</Button> } },
  {
    label: "Every slot",
    props: {
      subTitle: "LLM judge",
      titleExtra: <Counter variant="quiet">4</Counter>,
      headerContent: ANNOTATION_TOKENS,
      extra: <Button size="S">Edit</Button>,
    },
  },
];

export const HeaderSlots: StoryFn = () => (
  <OptionGrid
    rows={SLOTS}
    renderCell={(slot) => (
      <Card title="Annotations" width={CARD_WIDTH} {...slot.props}>
        <Body />
      </Card>
    )}
  />
);
HeaderSlots.storyName = "Header Slots";
HeaderSlots.tags = ["!dev"];
HeaderSlots.parameters = { themeLayout: "column" };

const COLLAPSE_STATES: { label: string; props: Partial<CardProps> }[] = [
  { label: "Not collapsible", props: {} },
  { label: "Open", props: { collapsible: true } },
  { label: "Closed", props: { collapsible: true, defaultOpen: false } },
];

const TITLE_MODES: {
  label: string;
  code?: boolean;
  props: Partial<CardProps>;
}[] = [
  { label: "Title toggles", props: {} },
  {
    label: "interactiveTitle",
    code: true,
    props: {
      interactiveTitle: true,
      collapseButtonLabel: "Annotations",
      headerContent: ANNOTATION_TOKENS,
    },
  },
];

export const CollapseStates: StoryFn = () => (
  <OptionGrid
    rows={COLLAPSE_STATES}
    columns={TITLE_MODES}
    renderCell={(state, mode) => (
      <Card
        title="Annotations"
        width="300px"
        extra={<Button size="S">Edit</Button>}
        {...state.props}
        {...mode?.props}
      >
        <Body />
      </Card>
    )}
  />
);
CollapseStates.storyName = "Collapse States";
CollapseStates.tags = ["!dev"];
CollapseStates.parameters = { themeLayout: "column" };

const MESSAGES = [
  [
    "system",
    "You are a friendly assistant that helps users answer questions about their observability data.",
  ],
  ["user", "What's the weather in SF today?"],
  ["assistant", 'get_weather({"city":"San Francisco"})'],
];

/**
 * The shape span details renders: collapsed message cards inside an open
 * card. The open outer card does not hide the previews nested under it.
 */
export const CollapsedPreview: StoryFn = () => (
  // No excerpt is pre-ellipsised, so any ellipsis here is one the browser drew.
  <Card title="Input" collapsible width="420px">
    <View padding="size-200">
      <Flex direction="column" gap="size-100">
        {MESSAGES.map(([role, preview]) => (
          <Card
            key={role}
            title={role}
            collapsible
            defaultOpen={false}
            headerContent={
              <CardCollapsedPreview>{preview}</CardCollapsedPreview>
            }
          >
            <View padding="size-200">
              <Text>{preview}</Text>
            </View>
          </Card>
        ))}
      </Flex>
    </View>
  </Card>
);
CollapsedPreview.storyName = "Collapsed Preview";
CollapsedPreview.tags = ["!dev"];
CollapsedPreview.parameters = { themeLayout: "column" };

const LONG_BODY = Array.from({ length: 8 }, (_, index) => (
  <Text key={index}>Example {index + 1} matched the reference answer.</Text>
));

const BODY_OPTIONS: {
  label: string;
  code: true;
  props: Partial<CardProps>;
  children: ReactNode;
}[] = [
  {
    label: "titleSeparator={false}",
    code: true,
    props: { titleSeparator: false },
    children: <Body />,
  },
  {
    label: "scrollBody",
    code: true,
    props: { scrollBody: true, height: "160px" },
    children: (
      <View padding="size-200">
        <Flex direction="column" gap="size-100">
          {LONG_BODY}
        </Flex>
      </View>
    ),
  },
];

export const BodyOptions: StoryFn = () => (
  <OptionGrid
    rows={BODY_OPTIONS}
    renderCell={(option) => (
      <Card title="Results" width={CARD_WIDTH} {...option.props}>
        {option.children}
      </Card>
    )}
  />
);
BodyOptions.storyName = "Body Options";
BodyOptions.tags = ["!dev"];
BodyOptions.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Card title="Card" width="100%">
      <View padding="size-200">
        <Text>A titled surface for grouping related content.</Text>
      </View>
    </Card>
  ),
};
