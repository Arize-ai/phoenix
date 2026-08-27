import { css } from "@emotion/react";
import { Suspense, useRef, useState } from "react";
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
      <Flex justifyContent="start">
        <LinkButton size="S" variant="primary" to={paths.gallery}>
          Browse the library
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
    const firstCategoryCard = categoryCardList?.children.item(0);
    const targetCategoryCard = categoryCardList?.children.item(categoryIndex);
    if (
      categoryCardList &&
      firstCategoryCard instanceof HTMLElement &&
      targetCategoryCard instanceof HTMLElement
    ) {
      // Measure actual offsets so the scroll target stays aligned if card or
      // gap tokens change.
      categoryCardList.scrollTo({
        left: targetCategoryCard.offsetLeft - firstCategoryCard.offsetLeft,
      });
    }
    setFirstVisibleCategoryIndex(categoryIndex);
  };

  const showPreviousCategories = () => {
    showCategoryAtIndex(Math.max(firstVisibleCategoryIndex - 1, 0));
  };
  const showNextCategories = () => {
    showCategoryAtIndex(
      Math.min(firstVisibleCategoryIndex + 1, lastFirstVisibleCategoryIndex)
    );
  };

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Evaluator categories"
    >
      <Flex direction="column" gap="size-200">
        <CategoryCarouselHeader
          hasPreviousCategories={hasPreviousCategories}
          hasNextCategories={hasNextCategories}
          onPrevious={showPreviousCategories}
          onNext={showNextCategories}
        />
        <ul
          ref={categoryCardListRef}
          id={CATEGORY_CAROUSEL_ID}
          css={categoryCardListCSS}
          aria-live="polite"
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
      </Flex>
    </section>
  );
}

function EvaluatorCategoryCardsSkeleton() {
  return (
    <Flex direction="column" gap="size-200" aria-hidden="true">
      <CategoryCarouselHeader />
      <ul css={categoryCardListCSS}>
        {PROJECT_EVALUATOR_CATEGORIES.slice(0, CATEGORY_CARDS_PER_VIEW).map(
          ({ value }) => (
            <li key={value}>
              <Skeleton height={CATEGORY_CARD_MIN_HEIGHT} />
            </li>
          )
        )}
      </ul>
    </Flex>
  );
}

function EvaluatorCategoryCardsError() {
  return <CategoryCards templates={[]} />;
}

function CategoryCarouselHeader({
  hasPreviousCategories = false,
  hasNextCategories = false,
  onPrevious,
  onNext,
}: {
  hasPreviousCategories?: boolean;
  hasNextCategories?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  return (
    <Flex
      direction="row"
      gap="size-100"
      wrap="wrap"
      alignItems="center"
      justifyContent="space-between"
    >
      <Flex direction="row" gap="size-100" wrap="wrap" alignItems="baseline">
        <Text elementType="h2" size="S" weight="heavy">
          Browse by category
        </Text>
        <Text size="S" color="text-700">
          Pick an area to start browsing.
        </Text>
      </Flex>
      <Flex direction="row" gap="size-50">
        <IconButton
          size="S"
          isDisabled={!hasPreviousCategories}
          onPress={onPrevious}
          aria-label="Previous evaluator categories"
          aria-controls={CATEGORY_CAROUSEL_ID}
        >
          <Icon svg={<Icons.ChevronLeftSmall />} />
        </IconButton>
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
  padding: var(--global-dimension-size-400) var(--global-dimension-size-300)
    var(--global-dimension-size-600);
`;

const categoryCardListCSS = css`
  --category-card-gap: var(--global-dimension-size-125);

  display: flex;
  gap: var(--category-card-gap);
  overflow: hidden;
  margin: 0;
  padding: 0;
  list-style: none;
  scroll-behavior: smooth;

  > li {
    display: flex;
    flex: 0 0
      calc(
        (100% - var(--category-card-gap) - var(--category-card-gap)) /
          ${CATEGORY_CARDS_PER_VIEW}
      );
  }

  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;
  }
`;

const categoryCardCSS = css`
  box-sizing: border-box;
  flex-direction: column;
  min-height: ${CATEGORY_CARD_MIN_HEIGHT}px;
  min-width: 0;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-small);

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
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--global-card-header-background-color-hover);
    text-decoration: none;
  }
`;

const templateLinkListCSS = css`
  box-sizing: border-box;
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  width: 100%;
  height: var(--global-dimension-size-1700);
  margin: 0;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  list-style: none;

  li {
    min-width: 0;
  }

  .link-container {
    display: flex;
    width: 100%;
    max-width: none;
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
