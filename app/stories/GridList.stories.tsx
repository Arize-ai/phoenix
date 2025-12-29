import { Meta, StoryFn } from "@storybook/react";
import { css } from "@emotion/react";

import {
  GridList,
  GridListItem,
  GridListProps,
  GridListSection,
  GridListSectionTitle,
  Icon,
  IconButton,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationNameAndValue } from "@phoenix/components/annotation/AnnotationNameAndValue";
import { Annotation } from "@phoenix/components/annotation/types";

const meta: Meta = {
  title: "GridList",
  component: GridList,
};

export default meta;

const Template: StoryFn<Omit<GridListProps<object>, "children">> = (props) => (
  <div
    css={css`
      border: 1px solid var(--ac-global-color-grey-300);
      border-radius: var(--ac-global-rounding-small);
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

/**
 * Basic grid list with single selection
 */
export const Default = Template.bind({});

Default.args = {
  selectionMode: "single",
};

/**
 * Grid list with checkboxes for multiple selection
 */
export const WithCheckboxes = Template.bind({});

WithCheckboxes.args = {
  selectionMode: "multiple",
  selectionBehavior: "toggle",
};

const SAMPLE_ANNOTATIONS: Annotation[] = [
  { name: "Quality", label: "High", score: 0.95 },
  { name: "Relevance", label: "Good", score: 0.82 },
  { name: "Accuracy", label: "Medium", score: 0.67 },
  { name: "Completeness", label: "Low", score: 0.45 },
  { name: "Clarity", label: "Excellent", score: 0.98 },
  { name: "Coherence", label: "Fair", score: 0.71 },
];

/**
 * Grid list with subtitle and trailing content
 */
export const WithSubtitleAndTrailingContent: StoryFn<
  Omit<GridListProps<object>, "children">
> = (props) => (
  <div
    css={css`
      border: 1px solid var(--ac-global-color-grey-300);
      border-radius: var(--ac-global-rounding-small);
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
);

WithSubtitleAndTrailingContent.args = {
  selectionMode: "multiple",
  selectionBehavior: "toggle",
};

/**
 * Empty grid list
 */
export const Empty: StoryFn<Omit<GridListProps<object>, "children">> = (
  props
) => (
  <div
    css={css`
      border: 1px solid var(--ac-global-color-grey-300);
      border-radius: var(--ac-global-rounding-small);
    `}
  >
    <GridList
      aria-label="Empty grid list"
      renderEmptyState={() => (
        <View padding="size-100">
          <Text color="grey-300" size="S">
            No items found
          </Text>
        </View>
      )}
      {...props}
    ></GridList>
  </div>
);

/**
 * Grid list with sections
 */
export const WithSections: StoryFn<Omit<GridListProps<object>, "children">> = (
  props
) => (
  <div
    css={css`
      border: 1px solid var(--ac-global-color-grey-300);
      border-radius: var(--ac-global-rounding-small);
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
);

WithSections.args = {
  selectionMode: "multiple",
  selectionBehavior: "toggle",
};
