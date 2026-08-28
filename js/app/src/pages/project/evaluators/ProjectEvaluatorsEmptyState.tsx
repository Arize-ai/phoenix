import { css } from "@emotion/react";
import { type ReactNode, Suspense, useRef, useState } from "react";
import { useLazyLoadQuery } from "react-relay";

import {
  Flex,
  Icon,
  IconButton,
  Icons,
  Link,
  LinkButton,
  Skeleton,
  Text,
} from "@phoenix/components";
import { ErrorBoundary } from "@phoenix/components/exception";
import type { projectEvaluatorTemplatesQuery as ProjectEvaluatorTemplatesQueryType } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import { BuildProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import {
  PROJECT_EVALUATOR_CATEGORIES,
  type ProjectEvaluatorTemplate,
  projectEvaluatorTemplatesQuery,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTemplates";

const MAX_CATEGORY_TEMPLATES = 3;
const CATEGORY_CARDS_PER_VIEW = 3;
const CATEGORY_CARD_MIN_HEIGHT = 250;
const CATEGORY_CAROUSEL_ID = "project-evaluator-category-carousel";

export function ProjectEvaluatorsEmptyState() {
  const paths = useProjectEvaluatorPaths();
  return (
    <Flex
      direction="column"
      gap="size-200"
      width="100%"
      maxWidth="var(--global-text-content-max-width)"
      css={emptyStateContentCSS}
    >
      <ErrorBoundary fallback={EvaluatorCategoryCardsError}>
        <Suspense fallback={<EvaluatorCategoryCardsSkeleton />}>
          <EvaluatorCategoryCards />
        </Suspense>
      </ErrorBoundary>
      <Flex direction="row" gap="size-100" wrap="wrap" justifyContent="center">
        <BuildProjectEvaluatorMenu
          size="S"
          creationPaths={paths.listCreation}
        />
        <LinkButton size="S" variant="primary" to={paths.gallery}>
          Browse eval gallery
        </LinkButton>
      </Flex>
    </Flex>
  );
}

function EvaluatorCategoryCards() {
  const data = useLazyLoadQuery<ProjectEvaluatorTemplatesQueryType>(
    projectEvaluatorTemplatesQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );
  return <CategoryCards templates={data.evaluatorGalleryConfigs} />;
}

function CategoryCards({
  templates,
}: {
  templates: readonly ProjectEvaluatorTemplate[];
}) {
  const paths = useProjectEvaluatorPaths();
  // Keep the full track mounted so native scrolling can animate continuously
  // between neighboring groups of cards.
  const categoryCardListRef = useRef<HTMLUListElement>(null);
  const [firstVisibleCategoryIndex, setFirstVisibleCategoryIndex] = useState(0);
  const lastFirstVisibleCategoryIndex = Math.max(
    PROJECT_EVALUATOR_CATEGORIES.length - CATEGORY_CARDS_PER_VIEW,
    0
  );
  const hasPreviousCategories = firstVisibleCategoryIndex > 0;
  const hasNextCategories =
    firstVisibleCategoryIndex < lastFirstVisibleCategoryIndex;

  const showCategoryAtIndex = (categoryIndex: number) => {
    const categoryCardList = categoryCardListRef.current;
    const targetCategoryCard = categoryCardList?.children.item(categoryIndex);
    if (categoryCardList && targetCategoryCard instanceof HTMLElement) {
      const categoryCardListRect = categoryCardList.getBoundingClientRect();
      const targetCategoryCardRect = targetCategoryCard.getBoundingClientRect();
      const scrollPaddingInlineStart =
        Number.parseFloat(
          getComputedStyle(categoryCardList).scrollPaddingInlineStart
        ) || 0;
      // Move only the carousel. scrollIntoView would also move the table's
      // shared horizontal scroll container when the table overflows.
      categoryCardList.scrollTo({
        left:
          categoryCardList.scrollLeft +
          targetCategoryCardRect.left -
          categoryCardListRect.left -
          scrollPaddingInlineStart,
      });
    }
    setFirstVisibleCategoryIndex(categoryIndex);
  };

  const showPreviousCategories = () => {
    showCategoryAtIndex(
      Math.max(firstVisibleCategoryIndex - CATEGORY_CARDS_PER_VIEW, 0)
    );
  };
  const showNextCategories = () => {
    showCategoryAtIndex(
      Math.min(
        firstVisibleCategoryIndex + CATEGORY_CARDS_PER_VIEW,
        lastFirstVisibleCategoryIndex
      )
    );
  };

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Evaluator categories"
    >
      <CategoryCarouselControls
        hasPreviousCategories={hasPreviousCategories}
        hasNextCategories={hasNextCategories}
        onPrevious={showPreviousCategories}
        onNext={showNextCategories}
      >
        <ul
          ref={categoryCardListRef}
          id={CATEGORY_CAROUSEL_ID}
          css={categoryCardListCSS}
          aria-live="polite"
          data-overflow-start={hasPreviousCategories}
          data-overflow-end={hasNextCategories}
        >
          {PROJECT_EVALUATOR_CATEGORIES.map(
            ({ value, label, description }, categoryIndex) => {
              const categoryTemplates = templates
                .filter(({ category }) => category === value)
                .slice(0, MAX_CATEGORY_TEMPLATES);
              const isCategoryVisible =
                categoryIndex >= firstVisibleCategoryIndex &&
                categoryIndex <
                  firstVisibleCategoryIndex + CATEGORY_CARDS_PER_VIEW;
              return (
                <li
                  key={value}
                  css={categoryCardCSS}
                  // Offscreen cards remain mounted for motion, so exclude
                  // their links from the accessibility tree and tab order.
                  aria-hidden={isCategoryVisible ? undefined : true}
                  inert={isCategoryVisible ? undefined : true}
                >
                  <Link
                    to={paths.galleryCategory(value)}
                    css={categorySummaryLinkCSS}
                  >
                    <Text weight="heavy" color="inherit">
                      {label}
                    </Text>
                    <Text size="S" color="text-700">
                      {description}
                    </Text>
                  </Link>
                  {categoryTemplates.length > 0 ? (
                    <ul css={templateLinkListCSS}>
                      {categoryTemplates.map((template) => (
                        <li key={template.name}>
                          <Link
                            to={paths.galleryTemplate({
                              category: value,
                              templateName: template.name,
                            })}
                            css={templateLinkCSS}
                          >
                            <Text size="XS" color="inherit">
                              {template.name}
                            </Text>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            }
          )}
        </ul>
      </CategoryCarouselControls>
    </section>
  );
}

function EvaluatorCategoryCardsSkeleton() {
  const hasCategoryOverflow =
    PROJECT_EVALUATOR_CATEGORIES.length > CATEGORY_CARDS_PER_VIEW;
  return (
    <div aria-hidden="true">
      <CategoryCarouselControls>
        <ul
          id={CATEGORY_CAROUSEL_ID}
          css={categoryCardListCSS}
          data-overflow-end={hasCategoryOverflow}
        >
          {PROJECT_EVALUATOR_CATEGORIES.slice(
            0,
            CATEGORY_CARDS_PER_VIEW + 1
          ).map(({ value }) => (
            <li key={value}>
              <Skeleton height={CATEGORY_CARD_MIN_HEIGHT} />
            </li>
          ))}
        </ul>
      </CategoryCarouselControls>
    </div>
  );
}

function EvaluatorCategoryCardsError() {
  return <CategoryCards templates={[]} />;
}

function CategoryCarouselControls({
  children,
  hasPreviousCategories = false,
  hasNextCategories = false,
  onPrevious,
  onNext,
}: {
  children: ReactNode;
  hasPreviousCategories?: boolean;
  hasNextCategories?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  return (
    <Flex direction="row" gap="size-100" alignItems="center" width="100%">
      <Flex alignItems="center" css={categoryCarouselControlCSS}>
        <IconButton
          size="S"
          isDisabled={!hasPreviousCategories}
          onPress={onPrevious}
          aria-label="Previous evaluator categories"
          aria-controls={CATEGORY_CAROUSEL_ID}
        >
          <Icon svg={<Icons.ChevronLeftSmall />} />
        </IconButton>
      </Flex>
      {children}
      <Flex alignItems="center" css={categoryCarouselControlCSS}>
        <IconButton
          size="S"
          isDisabled={!hasNextCategories}
          onPress={onNext}
          aria-label="Next evaluator categories"
          aria-controls={CATEGORY_CAROUSEL_ID}
        >
          <Icon svg={<Icons.ChevronRightSmall />} />
        </IconButton>
      </Flex>
    </Flex>
  );
}

const emptyStateContentCSS = css`
  box-sizing: border-box;
  margin-inline: auto;
  padding: var(--global-dimension-size-700) 0 var(--global-dimension-size-600);
`;

const categoryCarouselControlCSS = css`
  position: relative;
  align-self: stretch;

  > button {
    position: static;

    /* Extend the real button's hit target without enlarging its visual state. */
    &::before {
      content: "";
      position: absolute;
      inset: 0;
    }
  }
`;

const categoryCardListCSS = css`
  --category-card-gap: var(--global-dimension-size-125);
  --category-carousel-peek: var(--global-dimension-size-250);
  --category-carousel-fade-start: 0px;
  --category-carousel-fade-end: 0px;

  box-sizing: border-box;
  display: flex;
  flex: 1;
  gap: var(--category-card-gap);
  min-width: 0;
  overflow: hidden;
  margin: 0;
  /* Reserve the same edge slot whether it holds empty space or a card peek. */
  padding: 0 var(--category-carousel-peek);
  list-style: none;
  scroll-padding-inline: var(--category-carousel-peek);
  scroll-behavior: smooth;

  > li {
    display: flex;
    flex: 0 0
      calc(
        (100% - var(--category-card-gap) - var(--category-card-gap)) /
          ${CATEGORY_CARDS_PER_VIEW}
      );
  }

  &[data-overflow-start="true"] {
    --category-carousel-fade-start: var(--category-carousel-peek);
  }

  &[data-overflow-end="true"] {
    --category-carousel-fade-end: var(--category-carousel-peek);
  }

  /* Match the directional overflow treatment used by horizontal tabs. */
  &:is([data-overflow-start="true"], [data-overflow-end="true"]) {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      black var(--category-carousel-fade-start),
      black calc(100% - var(--category-carousel-fade-end)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      black var(--category-carousel-fade-start),
      black calc(100% - var(--category-carousel-fade-end)),
      transparent
    );
  }

  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;
  }
`;

const categoryCardCSS = css`
  box-sizing: border-box;
  position: relative;
  isolation: isolate;
  flex-direction: column;
  min-height: ${CATEGORY_CARD_MIN_HEIGHT}px;
  min-width: 0;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  transition: background-color 0.15s ease;

  &:has(> .link-container > a:hover) {
    background-color: var(--global-card-header-background-color-hover);
  }

  > .link-container {
    display: flex;
    flex: 1;
    width: 100%;
    max-width: none;
    min-height: 0;
  }
`;

const categorySummaryLinkCSS = css`
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  width: 100%;
  padding: var(--global-dimension-size-200) var(--global-dimension-size-200)
    var(--global-dimension-size-100);
  border-radius: var(--global-rounding-small) var(--global-rounding-small) 0 0;
  color: var(--global-text-color-900);

  /* Stretch this anchor without wrapping the sibling template links. */
  &::after {
    content: "";
    position: absolute;
    z-index: 0;
    inset: 0;
    border-radius: var(--global-rounding-small);
  }

  &:focus-visible {
    outline: none;
  }

  &:focus-visible::after {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }

  &:hover {
    text-decoration: none;
  }
`;

const templateLinkListCSS = css`
  --template-link-gap: var(--global-dimension-size-100);

  box-sizing: border-box;
  position: relative;
  z-index: 1;
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--template-link-gap);
  width: 100%;
  height: var(--global-dimension-size-1700);
  margin: 0;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  list-style: none;
  /* Padding falls through to the category link; rows and gaps opt back in. */
  pointer-events: none;

  li {
    min-width: 0;
  }

  li + li {
    position: relative;

    &::before {
      content: "";
      position: absolute;
      top: calc(-1 * var(--template-link-gap));
      right: 0;
      left: 0;
      height: var(--template-link-gap);
      pointer-events: auto;
    }
  }

  .link-container {
    display: flex;
    width: 100%;
    max-width: none;
    pointer-events: auto;
  }
`;

const templateLinkCSS = css`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: none;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  background-color: var(--global-card-header-background-color);
  color: var(--global-text-color-900);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    background-color: var(--global-card-header-background-color-hover);
    border-color: var(--global-color-gray-400);
    text-decoration: none;
  }
`;
