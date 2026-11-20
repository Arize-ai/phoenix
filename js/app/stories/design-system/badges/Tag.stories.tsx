import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { fn } from "storybook/test";

import type { TagColor, TagProps } from "@phoenix/components";
import { Icon, Icons, Tag, TAG_COLORS } from "@phoenix/components";
import type { FamilySize } from "@phoenix/components/core/types";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A Tag: a separate object attached to a thing, with its own identity, such
 * as a prompt label, a dataset label, a release tag or a project reference.
 * Cornered, like the rest of Phoenix's operable controls, because it is the
 * only member of this family that may be a hit target.
 *
 * What a person can do with the tag on this surface picks its interaction,
 * and a tag has at most one primary action and one secondary:
 *
 * - **Read-only**: neither `onPress` nor `onRemove`. A plain span, not
 *   focusable, with no hover.
 * - **Operational**: `onPress` does one thing, such as opening the
 *   version's detail. The whole tag is one button.
 * - **Link**: `href` goes to the object's page, such as the project. The
 *   tag is a real link, so it opens in a new tab and copies as a link.
 * - **Dismissible**: `onRemove` adds a remove button named after
 *   the tag ("Remove Staging"). Pass it only where the person is editing the set; the same tag
 *   is read-only everywhere else.
 * - **Press and remove**: both, as two focus stops, the body and the remove
 *   button.
 *
 * A tag's color comes from one of two sources, never both:
 *
 * - **`color`**, a named hue, whenever Phoenix chooses it: a release tag
 *   colored by its name, a project reference, any tag the system attaches.
 * - **`userColor`**, any CSS color, only for a color a person picked and
 *   Phoenix stored as given, such as a prompt label's, dataset label's or
 *   split's hex. Phoenix never invents a `userColor`; if the system needs a
 *   hue, it names one.
 *
 * A selectable tag belongs to a set, so selection lives on `TagGroup`, which
 * also lays out any number of tags. Hover, pressed and focus states need a
 * pointer or keyboard; press the operational tags here to see them.
 */
const meta: Meta = {
  title: "Design System/Badges/Tag",
  component: Tag,
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const INTERACTIONS: {
  label: string;
  props: Pick<TagProps, "onPress" | "onRemove">;
}[] = [
  { label: "Read-only", props: {} },
  { label: "Operational", props: { onPress: fn() } },
  { label: "Dismissible", props: { onRemove: fn() } },
  { label: "Press and remove", props: { onPress: fn(), onRemove: fn() } },
];

const SIZES: { label: FamilySize; code: true }[] = [
  { label: "S", code: true },
  { label: "M", code: true },
];

const STATES: { label: string; isDisabled: boolean }[] = [
  { label: "Enabled", isDisabled: false },
  { label: "Disabled", isDisabled: true },
];

const CONTENT: { label: string; leadingVisual?: ReactNode }[] = [
  { label: "Bare" },
  { label: "Leading visual", leadingVisual: <Icon svg={<Icons.Grid />} /> },
];

const COLORS: { label: TagColor; code: true }[] = TAG_COLORS.map((color) => ({
  label: color,
  code: true,
}));

const THUMBNAIL_TAGS: { color: TagColor; text: string }[] = [
  { color: "neutral", text: "Production" },
  { color: "cyan", text: "Staging" },
  { color: "purple", text: "Needs review" },
  { color: "magenta", text: "Regression" },
  { color: "green", text: "Golden" },
];

const COLOR_INTERACTIONS = INTERACTIONS.filter(
  (interaction) =>
    interaction.label === "Read-only" || interaction.label === "Dismissible"
);

const LENGTHS: { label: string; text: string }[] = [
  { label: "Regular", text: "Production" },
  { label: "Long", text: "Candidate for release after review" },
];

const ATTACHMENTS: { label: string; icon: ReactNode; text: string }[] = [
  { label: "Trace", icon: <Icons.Trace />, text: "Trace ee6a3a" },
  { label: "Span", icon: <Icons.Span />, text: "Span 3f9c1d" },
  { label: "Dataset", icon: <Icons.Database />, text: "Golden questions" },
];

export const Default: StoryFn = () => <Tag>Production</Tag>;
Default.tags = ["!dev"];

export const InteractionsAndSizes: StoryFn = () => (
  <OptionGrid
    rows={INTERACTIONS}
    columns={SIZES}
    renderCell={(interaction, size) => (
      <Tag size={size?.label} {...interaction.props}>
        staging
      </Tag>
    )}
  />
);
InteractionsAndSizes.tags = ["!dev"];
InteractionsAndSizes.parameters = { themeLayout: "column" };

export const InteractionsAndStates: StoryFn = () => (
  <OptionGrid
    rows={INTERACTIONS}
    columns={STATES}
    renderCell={(interaction, state) => (
      <Tag isDisabled={state?.isDisabled} {...interaction.props}>
        staging
      </Tag>
    )}
  />
);
InteractionsAndStates.tags = ["!dev"];
InteractionsAndStates.parameters = { themeLayout: "column" };

const LINKS: {
  label: string;
  onRemove?: () => void;
}[] = [{ label: "Link" }, { label: "Link and remove", onRemove: fn() }];

export const LinksAndSizes: StoryFn = () => (
  <OptionGrid
    rows={LINKS}
    columns={SIZES}
    renderCell={(link, size) => (
      <Tag
        href="/projects/UHJvamVjdDox"
        onRemove={link.onRemove}
        size={size?.label}
        leadingVisual={<Icon svg={<Icons.Grid />} />}
      >
        chatbot-prod
      </Tag>
    )}
  />
);
LinksAndSizes.tags = ["!dev"];
LinksAndSizes.parameters = { themeLayout: "row" };

export const ContentAndSizes: StoryFn = () => (
  <OptionGrid
    rows={CONTENT}
    columns={SIZES}
    renderCell={(content, size) => (
      <Tag
        size={size?.label}
        leadingVisual={content.leadingVisual}
        onPress={fn()}
      >
        my-project
      </Tag>
    )}
  />
);
ContentAndSizes.tags = ["!dev"];
ContentAndSizes.parameters = { themeLayout: "column" };

export const ColorsAndInteractions: StoryFn = () => (
  <OptionGrid
    rows={COLORS}
    columns={COLOR_INTERACTIONS}
    renderCell={(color, interaction) => (
      <Tag color={color.label} {...interaction?.props}>
        Staging
      </Tag>
    )}
  />
);
ColorsAndInteractions.tags = ["!dev"];
ColorsAndInteractions.parameters = { themeLayout: "column" };

const LABEL_PICKER_COLORS = [
  "#ff9b88",
  "#ffa037",
  "#d7b300",
  "#98c50a",
  "#4ecf50",
  "#49cc93",
  "#33c5e8",
  "#78bbfa",
  "#acafff",
  "#cca4fd",
  "#f592f3",
  "#ff95bd",
];

/**
 * The hexes the label and split color pickers store, passed through
 * `userColor`. The fill, border and text are derived from the stored color
 * the same way as from a named hue.
 */
export const UserColors: StoryFn = () => (
  <OptionGrid
    rows={LABEL_PICKER_COLORS.map((hex) => ({ label: hex, code: true }))}
    columns={COLOR_INTERACTIONS}
    renderCell={(hex, interaction) => (
      <Tag userColor={hex.label} {...interaction?.props}>
        Needs review
      </Tag>
    )}
  />
);
UserColors.tags = ["!dev"];
UserColors.parameters = { themeLayout: "column" };

/**
 * `maxWidth` truncates the name, never the remove button, and gives the tag
 * the full name as its tooltip.
 */
export const ContentLength: StoryFn = () => (
  <OptionGrid
    rows={LENGTHS}
    columns={COLOR_INTERACTIONS}
    renderCell={(length, interaction) => (
      <Tag maxWidth="120px" {...interaction?.props}>
        {length.text}
      </Tag>
    )}
  />
);
ContentLength.tags = ["!dev"];
ContentLength.parameters = { themeLayout: "column" };

/**
 * The shape of a PXI context attachment: the body opens the attached object
 * and the remove button detaches it, as two focus stops. The leading icon is
 * the object's noun icon.
 */
export const Attachment: StoryFn = () => (
  <OptionGrid
    rows={ATTACHMENTS}
    renderCell={(attachment) => (
      <Tag
        leadingVisual={<Icon svg={attachment.icon} />}
        onPress={fn()}
        onRemove={fn()}
      >
        {attachment.text}
      </Tag>
    )}
  />
);
Attachment.tags = ["!dev"];
Attachment.parameters = { themeLayout: "row" };

const thumbnailCSS = css`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--global-dimension-size-100);
  max-width: 260px;
`;

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div css={thumbnailCSS}>
      {THUMBNAIL_TAGS.map((tag, index) => (
        <Tag
          key={tag.text}
          color={tag.color}
          size="M"
          onRemove={index % 2 === 0 ? undefined : fn()}
        >
          {tag.text}
        </Tag>
      ))}
    </div>
  ),
};
