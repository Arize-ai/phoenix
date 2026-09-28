import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { Alert, Badge, Flex, Text, Token, View } from "@phoenix/components";

import { GLOBAL_COLORS } from "../../constants/colorConstants";
import { OptionGrid } from "../../utils/OptionGrid";

const meta: Meta = {
  title: "Design System/Color/Colors",
  tags: ["updated", "incomplete", "unreviewed"],
};

export default meta;

type Story = StoryObj;

function familyStory(family: string): Story {
  const steps = GLOBAL_COLORS.filter((color) =>
    color.startsWith(`${family}-`)
  ).map((color) => ({ label: color, code: true }));
  return {
    parameters: { themeLayout: "row" },
    render: () => (
      <OptionGrid
        rows={steps}
        renderCell={(step) => (
          <View backgroundColor={step.label} height={24} width={160} />
        )}
      />
    ),
  };
}

export const Gray: Story = { ...familyStory("gray"), tags: ["!dev"] };
export const Blue: Story = { ...familyStory("blue"), tags: ["!dev"] };
export const Red: Story = { ...familyStory("red"), tags: ["!dev"] };
export const Orange: Story = { ...familyStory("orange"), tags: ["!dev"] };
export const Yellow: Story = { ...familyStory("yellow"), tags: ["!dev"] };
export const Chartreuse: Story = {
  ...familyStory("chartreuse"),
  tags: ["!dev"],
};
export const Celery: Story = { ...familyStory("celery"), tags: ["!dev"] };
export const Green: Story = { ...familyStory("green"), tags: ["!dev"] };
export const Seafoam: Story = { ...familyStory("seafoam"), tags: ["!dev"] };
export const Cyan: Story = { ...familyStory("cyan"), tags: ["!dev"] };
export const Indigo: Story = { ...familyStory("indigo"), tags: ["!dev"] };
export const Purple: Story = { ...familyStory("purple"), tags: ["!dev"] };
export const Fuchsia: Story = { ...familyStory("fuchsia"), tags: ["!dev"] };
export const Magenta: Story = { ...familyStory("magenta"), tags: ["!dev"] };

const sectionTitleCSS = css`
  font-size: 14px;
  font-weight: 600;
  color: var(--global-text-color-900);
  margin: 0;
`;

const labelCSS = css`
  font-size: 11px;
  font-weight: 500;
  color: var(--global-text-color-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
`;

const swatchCSS = css`
  width: 20px;
  height: 20px;
  border-radius: var(--global-rounding-small);
  flex-shrink: 0;
`;

const levelRowCSS = css`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

const componentRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

type SemanticColor = {
  name: string;
  cssVar: string;
  badge: { variant: "info" | "success" | "warning" | "danger"; label: string };
  token: { color: string; label: string };
  alert: {
    variant: "info" | "success" | "warning" | "danger";
    message: string;
  };
};

const semanticColors: SemanticColor[] = [
  {
    name: "Info",
    cssVar: "var(--global-color-info)",
    badge: { variant: "info", label: "Active" },
    token: { color: "var(--global-color-info)", label: "Info" },
    alert: { variant: "info", message: "Informational message" },
  },
  {
    name: "Success",
    cssVar: "var(--global-color-success)",
    badge: { variant: "success", label: "Approved" },
    token: { color: "var(--global-color-success)", label: "Success" },
    alert: { variant: "success", message: "Operation completed successfully" },
  },
  {
    name: "Warning",
    cssVar: "var(--global-color-warning)",
    badge: { variant: "warning", label: "Pending" },
    token: { color: "var(--global-color-warning)", label: "Warning" },
    alert: { variant: "warning", message: "Approaching resource limits" },
  },
  {
    name: "Danger",
    cssVar: "var(--global-color-danger)",
    badge: { variant: "danger", label: "Failed" },
    token: { color: "var(--global-color-danger)", label: "Danger" },
    alert: { variant: "danger", message: "Operation failed" },
  },
];

export const SemanticColors: Story = {
  name: "Semantic Color",
  tags: ["!dev"],
  parameters: { themeLayout: "row" },
  render: () => (
    <Flex direction="column" gap="size-300">
      {semanticColors.map((color) => (
        <div key={color.name} css={levelRowCSS}>
          <Flex direction="row" gap="size-100" alignItems="center">
            <div css={swatchCSS} style={{ backgroundColor: color.cssVar }} />
            <p css={sectionTitleCSS}>{color.name}</p>
            <p css={labelCSS}>--global-color-{color.name.toLowerCase()}</p>
          </Flex>

          <div>
            <p css={labelCSS} style={{ marginBottom: 4 }}>
              Text Color
            </p>
            <Text
              size="L"
              weight="heavy"
              color="inherit"
              elementType="p"
              css={css`
                color: var(--global-color-${color.name.toLowerCase()});
              `}
            >
              {color.name} heading example
            </Text>
          </div>

          <div css={componentRowCSS}>
            <p css={labelCSS}>Badge</p>
            <Badge variant={color.badge.variant}>{color.badge.label}</Badge>
          </div>

          <div css={componentRowCSS}>
            <p css={labelCSS}>Token</p>
            <Token color={color.token.color}>{color.token.label}</Token>
          </div>

          <div>
            <p css={labelCSS} style={{ marginBottom: 4 }}>
              Alert
            </p>
            <Alert variant={color.alert.variant}>{color.alert.message}</Alert>
          </div>
        </div>
      ))}
    </Flex>
  ),
};

const THUMBNAIL_FAMILIES = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Flex direction="column" gap="size-50" width="100%">
      {THUMBNAIL_FAMILIES.map((family) => (
        <Flex key={family} direction="row">
          {GLOBAL_COLORS.filter((color) => color.startsWith(`${family}-`)).map(
            (color) => (
              <View key={color} backgroundColor={color} height={20} flex={1} />
            )
          )}
        </Flex>
      ))}
    </Flex>
  ),
};
