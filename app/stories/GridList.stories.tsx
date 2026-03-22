import { css } from "@emotion/react";
import type { StoryObj, Meta, StoryFn } from "@storybook/react";

import type { GridListProps } from "@phoenix/components";
import {
  GridList,
  GridListItem,
  GridListSection,
  GridListSectionTitle,
  Icon,
  IconButton,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationNameAndValue } from "@phoenix/components/annotation/AnnotationNameAndValue";
import type { Annotation } from "@phoenix/components/annotation/types";

const meta: Meta = {
  title: "Core/Navigation/Grid List",
  component: GridList,
};

export default meta;

const Template: StoryFn<Omit<GridListProps<object>, "children">> = (props) => (
  <div
    css={css`
      border: 1px solid var(--global-color-gray-300);
      border-radius: var(--global-rounding-small);
    `}
  >
    <GridList aria-label="Example grid list" {...props}>
      <GridListItem>Item 1</GridListItem>
      <GridListItem>Item 2</GridListItem>
      <GridListItem>Item 3</GridListItem>
      <GridListItem>Item 4</GridListItem>
      <GridListItem>Item 5</GridListItem>
      <GridListItem>Item 6</GridListItem>
    </GridList>
  </div>
);

export const Default = {
  render: Template,

  args: {
    selectionMode: "single",
  },
};

export const WithCheckboxes = {
  render: Template,

  args: {
    selectionMode: "multiple",
    selectionBehavior: "toggle",
  },
};

const SAMPLE_ANNOTATIONS: Annotation[] = [
  { name: "Quality", label: "High", score: 0.95 },
  { name: "Relevance", label: "Good", score: 0.82 },
  { name: "Accuracy", label: "Medium", score: 0.67 },
  { name: "Completeness", label: "Low", score: 0.45 },
  { name: "Clarity", label: "Excellent", score: 0.98 },
  { name: "Coherence", label: "Fair", score: 0.71 },
];

export const WithSubtitleAndTrailingContent: StoryObj<
  Omit<GridListProps<object>, "children">
> = {
  render: (props) => (
    <div
      css={css`
        border: 1px solid var(--global-color-gray-300);
        border-radius: var(--global-rounding-small);
      `}
    >
      <GridList aria-label="Items with details" {...props}>
        {SAMPLE_ANNOTATIONS.map((annotation, index) => (
          <GridListItem
            key={index}
            textValue={`Item ${index + 1}`}
            subtitle={
              <AnnotationNameAndValue
                annotation={annotation}
                displayPreference="none"
                size="S"
              />
            }
            trailingContent={
              <IconButton size="S" aria-label="More options">
                <Icon svg={<Icons.MoreHorizontalOutline />} />
              </IconButton>
            }
          >
            <Text>Item {index + 1}</Text>
          </GridListItem>
        ))}
      </GridList>
    </div>
  ),

  args: {
    selectionMode: "multiple",
    selectionBehavior: "toggle",
  },
};

export const Empty: StoryObj<Omit<GridListProps<object>, "children">> = {
  render: (props) => (
    <div
      css={css`
        border: 1px solid var(--global-color-gray-300);
        border-radius: var(--global-rounding-small);
      `}
    >
      <GridList
        aria-label="Empty grid list"
        renderEmptyState={() => (
          <View padding="size-100">
            <Text color="gray-300" size="S">
              No items found
            </Text>
          </View>
        )}
        {...props}
      ></GridList>
    </div>
  ),
};

export const WithSections: StoryObj<Omit<GridListProps<object>, "children">> = {
  render: (props) => (
    <div
      css={css`
        border: 1px solid var(--global-color-gray-300);
        border-radius: var(--global-rounding-small);
      `}
    >
      <GridList aria-label="Grid list with sections" {...props}>
        <GridListSection>
          <GridListSectionTitle title="Category A" />
          <GridListItem>Item A1</GridListItem>
          <GridListItem>Item A2</GridListItem>
          <GridListItem>Item A3</GridListItem>
        </GridListSection>
        <GridListSection>
          <GridListSectionTitle title="Category B" />
          <GridListItem>Item B1</GridListItem>
          <GridListItem>Item B2</GridListItem>
          <GridListItem>Item B3</GridListItem>
        </GridListSection>
        <GridListSection>
          <GridListSectionTitle title="Category C" />
          <GridListItem>Item C1</GridListItem>
          <GridListItem>Item C2</GridListItem>
        </GridListSection>
      </GridList>
    </div>
  ),

  args: {
    selectionMode: "multiple",
    selectionBehavior: "toggle",
  },
};
