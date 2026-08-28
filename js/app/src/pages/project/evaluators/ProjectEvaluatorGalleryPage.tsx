import { css } from "@emotion/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Header, ListBoxSection } from "react-aria-components";
import { useLazyLoadQuery } from "react-relay";
import { Outlet, useNavigate, useSearchParams } from "react-router";

import {
  Badge,
  Button,
  Counter,
  ExpandableContent,
  Flex,
  Heading,
  List,
  ListBox,
  ListBoxItem,
  ListItem,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectValue,
  Skeleton,
  Text,
} from "@phoenix/components";
import { AnnotationScoreText } from "@phoenix/components/annotation/AnnotationScoreText";
import {
  getOptimizationBounds,
  getPositiveOptimization,
} from "@phoenix/components/annotation/optimizationUtils";
import { LineClamp } from "@phoenix/components/core/utility/LineClamp";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";
import { ErrorBoundary } from "@phoenix/components/exception";
import {
  PROJECT_EVALUATOR_CATEGORY_PARAM,
  PROJECT_EVALUATOR_TEMPLATE_PARAM,
} from "@phoenix/constants/searchParams";
import type {
  EvaluatorCategory,
  projectEvaluatorTemplatesQuery as ProjectEvaluatorTemplatesQueryType,
} from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import { EvaluatorTemplateCard } from "@phoenix/pages/project/evaluators/EvaluatorTemplateCard";
import {
  type ProjectEvaluatorCreationPaths,
  useProjectEvaluatorPaths,
} from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import {
  getProjectEvaluatorTemplateCategoryLabel,
  getProjectEvaluatorTemplateChoices,
  getProjectEvaluatorTemplateMessages,
  PROJECT_EVALUATOR_CATEGORIES,
  type ProjectEvaluatorTemplate,
  projectEvaluatorTemplatesQuery,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTemplates";
import {
  formatEvaluationTargetPlural,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

const OTHER_CATEGORY = "other" as const;
const GALLERY_SKELETON_HEIGHT = 440;
/** The combined minimum width of the category, template, and details columns. */
const GALLERY_EXPANDED_MIN_WIDTH = 960;
/**
 * Once a use-case heading crosses into the top 30% of the scroll region, treat
 * it as the section the user is currently reading.
 */
const SCROLL_SPY_ROOT_MARGIN = "0px 0px -70% 0px";

type TemplateCategory = EvaluatorCategory | typeof OTHER_CATEGORY;

function getGalleryCategory(
  category: EvaluatorCategory | null
): TemplateCategory {
  return category ?? OTHER_CATEGORY;
}

function getCategoryHeadingId(category: TemplateCategory): string {
  return `project-evaluator-gallery-category-${category.toLowerCase()}`;
}

export function ProjectEvaluatorGalleryPage() {
  return (
    <main css={galleryContainerCSS}>
      <ErrorBoundary fallback={EvaluatorGalleryError}>
        <Suspense fallback={<EvaluatorGallerySkeleton />}>
          <EvaluatorGallery />
        </Suspense>
      </ErrorBoundary>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </main>
  );
}

function EvaluatorGallery() {
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useLazyLoadQuery<ProjectEvaluatorTemplatesQueryType>(
    projectEvaluatorTemplatesQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );
  const templates = data.evaluatorGalleryConfigs;
  const categories = useMemo(() => {
    const orderedCategories: TemplateCategory[] = [
      ...PROJECT_EVALUATOR_CATEGORIES.map(({ value }) => value),
      OTHER_CATEGORY,
    ];
    return orderedCategories.filter((category) =>
      templates.some(
        (template) => getGalleryCategory(template.category) === category
      )
    );
  }, [templates]);
  const templatesByCategory = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category,
          templates.filter(
            (template) => getGalleryCategory(template.category) === category
          ),
        ])
      ),
    [categories, templates]
  );
  const useCaseItems = categories.map((category) => ({
    id: category,
    name: getProjectEvaluatorTemplateCategoryLabel(
      category === OTHER_CATEGORY ? null : category
    ),
    count: templatesByCategory.get(category)?.length ?? 0,
  }));
  const requestedTemplateName = searchParams.get(
    PROJECT_EVALUATOR_TEMPLATE_PARAM
  );
  const selectedTemplate =
    templates.find(({ name }) => name === requestedTemplateName) ??
    templatesByCategory.get(categories[0])?.[0];

  // Section headings double as scroll-spy targets, so the sidebar can track
  // whichever use case is currently in view.
  const headingRefs = useRef(new Map<TemplateCategory, HTMLElement>());
  const templateScrollRegionRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<
    TemplateCategory | undefined
  >(() => {
    const requestedCategory = searchParams.get(
      PROJECT_EVALUATOR_CATEGORY_PARAM
    ) as TemplateCategory | null;
    return requestedCategory && categories.includes(requestedCategory)
      ? requestedCategory
      : categories[0];
  });

  const scrollToCategory = (category: TemplateCategory) => {
    headingRefs.current.get(category)?.scrollIntoView({ block: "start" });
    setActiveCategory(category);
  };

  // Deep links (e.g. from the empty state) land on a specific use case; jump
  // there once the headings have mounted.
  const didScrollToInitialCategoryRef = useRef(false);
  useEffect(() => {
    if (didScrollToInitialCategoryRef.current || !activeCategory) return;
    didScrollToInitialCategoryRef.current = true;
    headingRefs.current.get(activeCategory)?.scrollIntoView({ block: "start" });
    // Only ever run for the initial deep link; scroll position afterward is
    // driven entirely by the user and the scroll-spy observer below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scrollRegion = templateScrollRegionRef.current;
    if (!scrollRegion) return undefined;
    const headingsByElement = new Map<Element, TemplateCategory>(
      categories
        .map(
          (category) => [headingRefs.current.get(category), category] as const
        )
        .filter(
          (entry): entry is [HTMLElement, TemplateCategory] => entry[0] != null
        )
    );
    if (headingsByElement.size === 0) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const topmostVisibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          .at(0);
        const category = topmostVisibleEntry
          ? headingsByElement.get(topmostVisibleEntry.target)
          : undefined;
        if (category) {
          setActiveCategory(category);
        }
      },
      { root: scrollRegion, rootMargin: SCROLL_SPY_ROOT_MARGIN }
    );
    headingsByElement.forEach((_category, heading) =>
      observer.observe(heading)
    );
    return () => observer.disconnect();
  }, [categories]);

  const setSelectedTemplate = (templateName: string) => {
    setSearchParams((currentSearchParams) => {
      const nextSearchParams = new URLSearchParams(currentSearchParams);
      nextSearchParams.set(PROJECT_EVALUATOR_TEMPLATE_PARAM, templateName);
      return nextSearchParams;
    });
  };
  const renderCategoryItem = ({
    id,
    name,
    count,
  }: {
    id: TemplateCategory;
    name: string;
    count: number;
  }) => (
    <ListBoxItem key={id} id={id} textValue={name}>
      <Text size="S">{name}</Text>
      <Counter variant="quiet">{count}</Counter>
    </ListBoxItem>
  );

  return (
    <div css={galleryCSS} className="project-evaluator-gallery">
      <nav
        className="project-evaluator-gallery__categories"
        aria-label="Evaluator gallery navigation"
      >
        <EvaluatorGalleryAddMenu creationPaths={paths.galleryCreation} />
        <div className="project-evaluator-gallery__category-scroll-region">
          <ListBox
            aria-label="Use cases"
            className="project-evaluator-gallery__category-list"
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
            selectedKeys={activeCategory ? [activeCategory] : []}
            onSelectionChange={(selection) => {
              if (selection === "all") return;
              const category = selection.keys().next().value;
              if (typeof category === "string") {
                scrollToCategory(category as TemplateCategory);
              }
            }}
          >
            <ListBoxSection id="use-cases">
              <Header className="project-evaluator-gallery__category-section-heading">
                <Text
                  elementType="h2"
                  size="XS"
                  weight="heavy"
                  color="text-500"
                >
                  Use cases
                </Text>
              </Header>
              {useCaseItems.map(renderCategoryItem)}
            </ListBoxSection>
          </ListBox>
        </div>
      </nav>

      <section
        className="project-evaluator-gallery__templates"
        aria-label="Evaluator templates"
      >
        <div className="project-evaluator-gallery__compact-add-evaluator-menu">
          <EvaluatorGalleryAddMenu creationPaths={paths.galleryCreation} />
        </div>
        <Select
          aria-label="Evaluator use case"
          className="project-evaluator-gallery__compact-category-select"
          value={activeCategory}
          onChange={(category) => {
            if (typeof category === "string") {
              scrollToCategory(category as TemplateCategory);
            }
          }}
        >
          <Button size="S">
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover isNonModal closeOnInteractOutside>
            <ListBox css={compactCategoryListCSS}>
              <ListBoxSection id="compact-use-cases">
                <Header className="project-evaluator-gallery__category-section-heading">
                  <Text
                    elementType="h2"
                    size="XS"
                    weight="heavy"
                    color="text-500"
                  >
                    Use cases
                  </Text>
                </Header>
                {useCaseItems.map(renderCategoryItem)}
              </ListBoxSection>
            </ListBox>
          </Popover>
        </Select>
        <div
          ref={templateScrollRegionRef}
          className="project-evaluator-gallery__template-card-scroll-region"
        >
          {categories.map((category) => {
            const headingId = getCategoryHeadingId(category);
            return (
              <section
                key={category}
                className="project-evaluator-gallery__template-category-section"
              >
                <Text
                  ref={(element) => {
                    if (element) {
                      headingRefs.current.set(category, element);
                    } else {
                      headingRefs.current.delete(category);
                    }
                  }}
                  id={headingId}
                  className="project-evaluator-gallery__template-category-heading"
                  elementType="h2"
                  size="M"
                  weight="heavy"
                >
                  {getProjectEvaluatorTemplateCategoryLabel(
                    category === OTHER_CATEGORY ? null : category
                  )}
                </Text>
                <div className="project-evaluator-gallery__template-category-grid">
                  <ListBox
                    aria-labelledby={headingId}
                    className="project-evaluator-gallery__template-list"
                    items={templatesByCategory.get(category) ?? []}
                    layout="grid"
                    selectionMode="single"
                    selectionBehavior="replace"
                    selectedKeys={
                      selectedTemplate ? [selectedTemplate.name] : []
                    }
                    onSelectionChange={(selection) => {
                      if (selection === "all") return;
                      const templateName = selection.keys().next().value;
                      if (typeof templateName === "string") {
                        setSelectedTemplate(templateName);
                      }
                    }}
                    onAction={(key) => {
                      if (typeof key === "string") {
                        navigate(paths.galleryNewLlmFromTemplate(key));
                      }
                    }}
                  >
                    {(template) => (
                      <EvaluatorTemplateCard
                        key={template.name}
                        id={template.name}
                        textValue={template.name}
                      >
                        <Text size="S" weight="heavy">
                          {template.name}
                        </Text>
                        <LineClamp lines={3}>
                          <Text size="XS" color="text-700">
                            {template.description}
                          </Text>
                        </LineClamp>
                        <EvaluatorTemplateCardFooter
                          evaluatorKind="LLM"
                          evaluationTargets={[template.scope ?? "SPAN"]}
                        />
                      </EvaluatorTemplateCard>
                    )}
                  </ListBox>
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <aside className="project-evaluator-gallery__details" aria-live="polite">
        {selectedTemplate ? (
          <EvaluatorTemplateDetails
            template={selectedTemplate}
            onUseTemplate={() =>
              navigate(paths.galleryNewLlmFromTemplate(selectedTemplate.name))
            }
          />
        ) : (
          <Text size="S" color="text-500">
            No templates are available in the gallery.
          </Text>
        )}
      </aside>
    </div>
  );
}

function EvaluatorGalleryAddMenu({
  creationPaths,
}: {
  creationPaths: ProjectEvaluatorCreationPaths;
}) {
  return (
    <AddProjectEvaluatorMenu
      size="M"
      buttonClassName="project-evaluator-gallery__add-evaluator-button"
      buttonLabel="Add Custom Evaluator"
      shouldShowGalleryLink={false}
      creationPaths={creationPaths}
    />
  );
}

function EvaluatorTemplateCardFooter({
  evaluatorKind,
  evaluationTargets,
}: {
  evaluatorKind: "CODE" | "LLM";
  evaluationTargets: readonly [
    ProjectEvaluatorTarget,
    ...ProjectEvaluatorTarget[],
  ];
}) {
  return (
    <Flex
      className="project-evaluator-gallery__template-card-footer"
      direction="row"
      alignItems="center"
      gap="size-100"
      wrap
    >
      <Flex className="project-evaluator-gallery__template-kind">
        <EvaluatorKindToken kind={evaluatorKind} size="S" />
      </Flex>
      <Flex
        className="project-evaluator-gallery__template-targets"
        direction="row"
        gap="size-50"
        wrap
      >
        {evaluationTargets.map((target) => (
          <Badge
            key={target}
            size="S"
            title={`Evaluates ${formatEvaluationTargetPlural(target)}`}
          >
            {capitalize(formatEvaluationTargetPlural(target))}
          </Badge>
        ))}
      </Flex>
    </Flex>
  );
}

function EvaluatorTemplateDetails({
  template,
  onUseTemplate,
}: {
  template: ProjectEvaluatorTemplate;
  onUseTemplate: () => void;
}) {
  const choices = getProjectEvaluatorTemplateChoices(template);
  const optimizationBounds = getOptimizationBounds({
    annotationType: "CATEGORICAL",
    optimizationDirection: template.optimizationDirection,
    values: choices,
  });
  const messages = getProjectEvaluatorTemplateMessages(template);
  return (
    <Flex direction="column" gap="size-200" height="100%">
      <Flex direction="column" gap="size-100">
        <Heading level={2}>{template.name}</Heading>
        <Flex direction="row" gap="size-75" wrap>
          <EvaluatorKindToken kind="LLM" size="S" />
          <Badge size="S">
            {getProjectEvaluatorTemplateCategoryLabel(template.category)}
          </Badge>
        </Flex>
        {template.details ? (
          <Text size="S" color="text-700">
            {template.details}
          </Text>
        ) : null}
      </Flex>
      <dl className="project-evaluator-gallery__definition-list">
        <div>
          <dt>
            <Text size="XS" color="text-500">
              Target
            </Text>
          </dt>
          <dd>
            <Text size="S">
              {template.scope ? capitalize(template.scope.toLowerCase()) : "—"}
            </Text>
          </dd>
        </div>
        <div>
          <dt>
            <Text size="XS" color="text-500">
              Optimization
            </Text>
          </dt>
          <dd>
            <Text size="S">
              {capitalize(template.optimizationDirection.toLowerCase())}
            </Text>
          </dd>
        </div>
      </dl>
      <Flex direction="column" gap="size-75">
        <Text elementType="h3" size="S" weight="heavy">
          Annotation values
        </Text>
        <List size="S">
          {choices.map(({ label, score }) => (
            <ListItem key={label}>
              <Flex
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap="size-100"
              >
                <Text size="S">{label}</Text>
                <Text size="XS" color="text-500">
                  <AnnotationScoreText
                    elementType="span"
                    fontFamily="mono"
                    size="XS"
                    positiveOptimization={getPositiveOptimization({
                      score,
                      ...optimizationBounds,
                    })}
                  >
                    {score}
                  </AnnotationScoreText>
                </Text>
              </Flex>
            </ListItem>
          ))}
        </List>
      </Flex>
      {messages.length > 0 ? (
        <Flex direction="column" gap="size-75">
          <Text elementType="h3" size="S" weight="heavy">
            Prompt
          </Text>
          <div css={promptPreviewWellCSS}>
            <ExpandableContent
              height={PROMPT_PREVIEW_COLLAPSED_HEIGHT}
              expandedBehavior="grow"
              overlayBackgroundColor="var(--global-background-color-100)"
            >
              <Flex direction="column" gap="size-150">
                {messages.map((message) => (
                  <Flex key={message.id} direction="column" gap="size-25">
                    <Text size="XS" color="text-500" weight="heavy">
                      {capitalize(message.role)}
                    </Text>
                    <Text size="S" css={promptPreviewMessageCSS}>
                      {message.content}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </ExpandableContent>
          </div>
        </Flex>
      ) : null}
      <Flex direction="column" css={stickyUseTemplateFooterCSS}>
        <Button variant="primary" onPress={onUseTemplate}>
          Customize this evaluator
        </Button>
      </Flex>
    </Flex>
  );
}

// Bleeds out to the edges of the details column's own padding/gap (both
// `var(--global-dimension-size-200)`) and re-adds that same space as padding
// inside this element's own background, so nothing scrolls behind it.
const stickyUseTemplateFooterCSS = css`
  position: sticky;
  bottom: calc(-1 * var(--project-evaluator-gallery-column-padding));
  z-index: 1;
  margin: calc(-1 * var(--global-dimension-size-200))
    calc(-1 * var(--project-evaluator-gallery-column-padding))
    calc(-1 * var(--project-evaluator-gallery-column-padding));
  padding: var(--global-dimension-size-200)
    var(--project-evaluator-gallery-column-padding)
    var(--project-evaluator-gallery-column-padding);
  background-color: var(--global-background-color-default);
`;

const PROMPT_PREVIEW_COLLAPSED_HEIGHT = 160;

const promptPreviewWellCSS = css`
  background-color: var(--global-background-color-100);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-150);
`;

const promptPreviewMessageCSS = css`
  white-space: pre-wrap;
`;

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function EvaluatorGallerySkeleton() {
  return (
    <Skeleton width="100%" height="100%" borderRadius="none" animation="wave" />
  );
}

function EvaluatorGalleryError() {
  return (
    <Text size="S" color="text-500">
      Evaluator templates could not be loaded.
    </Text>
  );
}

const compactCategoryListCSS = css`
  gap: var(--global-dimension-size-100);

  .react-aria-ListBoxSection {
    display: flex;
    flex-direction: column;
  }

  .project-evaluator-gallery__category-section-heading {
    padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .react-aria-ListBoxItem {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
  }
`;

const galleryContainerCSS = css`
  box-sizing: border-box;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: ${GALLERY_SKELETON_HEIGHT}px;
  overflow: hidden;
  container: project-evaluator-gallery / inline-size;
`;

const galleryCSS = css`
  --project-evaluator-gallery-column-separator-width: var(
    --global-border-size-thin
  );
  --project-evaluator-gallery-column-padding: var(--global-dimension-size-200);
  --project-evaluator-gallery-template-card-min-width: var(
    --global-dimension-size-4600
  );
  --project-evaluator-gallery-template-column-min-width: calc(
    var(--project-evaluator-gallery-template-card-min-width) +
      var(--project-evaluator-gallery-column-padding) +
      var(--project-evaluator-gallery-column-padding) +
      var(--project-evaluator-gallery-column-separator-width)
  );

  box-sizing: border-box;
  display: grid;
  grid-template-columns:
    minmax(var(--global-dimension-size-3000), var(--global-dimension-size-4000))
    minmax(var(--global-dimension-size-4000), 1.5fr)
    minmax(var(--global-dimension-size-5000), 1fr);
  height: 100%;
  min-height: ${GALLERY_SKELETON_HEIGHT}px;
  overflow: hidden;
  background-color: var(--global-background-color-default);

  .project-evaluator-gallery__categories,
  .project-evaluator-gallery__templates,
  .project-evaluator-gallery__details {
    min-height: 0;
    padding: var(--project-evaluator-gallery-column-padding);
  }

  .project-evaluator-gallery__categories {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .project-evaluator-gallery__templates {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .project-evaluator-gallery__details {
    overflow-y: auto;
  }

  .project-evaluator-gallery__categories,
  .project-evaluator-gallery__templates {
    border-right: var(--project-evaluator-gallery-column-separator-width) solid
      var(--global-border-color-default);
  }

  .project-evaluator-gallery__category-list {
    flex: none;
    gap: var(--global-dimension-size-100);
    overflow: visible;

    .react-aria-ListBoxSection {
      display: flex;
      flex-direction: column;
    }

    .react-aria-ListBoxItem {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: var(--global-dimension-size-100);
    }
  }

  .project-evaluator-gallery__category-scroll-region {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    overflow-y: auto;
  }

  .project-evaluator-gallery__category-section-heading {
    padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .project-evaluator-gallery__add-evaluator-button {
    flex: none;
    align-self: stretch;
    width: 100%;
    margin-bottom: var(--global-dimension-size-200);
  }

  .project-evaluator-gallery__compact-category-select {
    display: none;
  }

  .project-evaluator-gallery__compact-add-evaluator-menu {
    display: none;
  }

  .project-evaluator-gallery__template-card-scroll-region {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-400);
    margin-top: var(--global-dimension-size-100);
    overflow-y: auto;
  }

  .project-evaluator-gallery__template-category-section {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
  }

  .project-evaluator-gallery__template-category-heading {
    /* Anchor target for the use-cases nav; offset so scrollIntoView doesn't
       tuck it flush against the scroll region's top edge. */
    scroll-margin-top: var(--global-dimension-size-100);
  }

  .project-evaluator-gallery__template-category-grid {
    display: grid;
    grid-template-columns: repeat(
      auto-fit,
      minmax(var(--project-evaluator-gallery-template-card-min-width), 1fr)
    );
    align-content: start;
    gap: var(--global-dimension-size-100);
  }

  .project-evaluator-gallery__template-list {
    display: contents;
  }

  .project-evaluator-gallery__template-card-footer {
    width: 100%;
    margin-top: auto;
  }

  .project-evaluator-gallery__template-kind {
    flex: none;
  }

  .project-evaluator-gallery__template-targets {
    min-width: 0;
  }

  .project-evaluator-gallery__definition-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--global-dimension-size-100);
    margin: 0;

    div {
      display: flex;
      flex-direction: column;
      gap: var(--global-dimension-size-25);
    }

    dd {
      margin: 0;
    }
  }

  @container project-evaluator-gallery (width < ${GALLERY_EXPANDED_MIN_WIDTH}px) {
    overflow-x: auto;
    overflow-y: hidden;
    grid-template-columns:
      minmax(
        var(--project-evaluator-gallery-template-column-min-width),
        var(--global-dimension-size-5000)
      )
      minmax(var(--global-dimension-size-5000), 1fr);

    .project-evaluator-gallery__categories {
      display: none;
    }

    .project-evaluator-gallery__compact-category-select {
      display: block;
      flex: none;
      width: 100%;
    }

    .project-evaluator-gallery__compact-add-evaluator-menu {
      display: flex;
      flex: none;
      justify-content: flex-start;
    }

    .project-evaluator-gallery__templates {
      grid-column: 1;
      grid-row: 1;
    }

    .project-evaluator-gallery__details {
      grid-column: 2;
      grid-row: 1;
    }
  }
`;
