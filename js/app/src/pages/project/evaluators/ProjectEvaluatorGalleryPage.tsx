import { css } from "@emotion/react";
import { Suspense } from "react";
import { Header, ListBoxSection } from "react-aria-components";
import { useLazyLoadQuery } from "react-relay";
import { Outlet, useNavigate, useSearchParams } from "react-router";

import {
  Badge,
  Button,
  Counter,
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
import { ErrorBoundary } from "@phoenix/components/exception";
import {
  PROJECT_EVALUATOR_CATEGORY_PARAM,
  PROJECT_EVALUATOR_TEMPLATE_PARAM,
} from "@phoenix/constants/searchParams";
import type {
  EvaluatorCategory,
  projectEvaluatorTemplatesQuery as ProjectEvaluatorTemplatesQueryType,
} from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import {
  getProjectEvaluatorTemplateCategoryLabel,
  getProjectEvaluatorTemplateChoices,
  type ProjectEvaluatorTemplate,
  projectEvaluatorTemplatesQuery,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTemplates";

const ALL_EVALUATORS_CATEGORY = "all" as const;
const RECOMMENDED_CATEGORY = "recommended" as const;
const OTHER_CATEGORY = "other" as const;
const GALLERY_SKELETON_HEIGHT = 440;
/** The combined minimum width of the category, template, and details columns. */
const GALLERY_EXPANDED_MIN_WIDTH = 960;

type TemplateCategory = EvaluatorCategory | typeof OTHER_CATEGORY;
type GalleryCategory =
  | TemplateCategory
  | typeof ALL_EVALUATORS_CATEGORY
  | typeof RECOMMENDED_CATEGORY;

function getGalleryCategory(
  category: EvaluatorCategory | null
): TemplateCategory {
  return category ?? OTHER_CATEGORY;
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
  const categories = Array.from(
    new Set(templates.map(({ category }) => getGalleryCategory(category)))
  );
  const recommendedTemplateCount = templates.filter(
    ({ recommended }) => recommended
  ).length;
  const quickStartItems = [
    {
      id: ALL_EVALUATORS_CATEGORY,
      name: "All evaluators",
      count: templates.length,
    },
    {
      id: RECOMMENDED_CATEGORY,
      name: "Recommended",
      count: recommendedTemplateCount,
    },
  ];
  const useCaseItems = categories.map((category) => ({
    id: category,
    name:
      category === OTHER_CATEGORY
        ? "Other"
        : getProjectEvaluatorTemplateCategoryLabel(category),
    count: templates.filter(
      ({ category: templateCategory }) =>
        getGalleryCategory(templateCategory) === category
    ).length,
  }));
  const categoryItems = [...quickStartItems, ...useCaseItems];
  const requestedCategory = searchParams.get(PROJECT_EVALUATOR_CATEGORY_PARAM);
  // Shared or stale URLs can contain an unknown category; Recommended is the
  // gallery's stable fallback.
  const activeCategoryItem = categoryItems.find(
    ({ id }) => id === requestedCategory
  );
  const activeCategory: GalleryCategory =
    activeCategoryItem?.id ?? RECOMMENDED_CATEGORY;
  const activeCategoryLabel = activeCategoryItem?.name ?? "Recommended";
  const visibleTemplates = templates.filter(({ recommended, category }) => {
    if (activeCategory === ALL_EVALUATORS_CATEGORY) {
      return true;
    }
    if (activeCategory === RECOMMENDED_CATEGORY) {
      return recommended;
    }
    return getGalleryCategory(category) === activeCategory;
  });
  const requestedTemplateName = searchParams.get(
    PROJECT_EVALUATOR_TEMPLATE_PARAM
  );
  // Fall back to the first visible template if a saved selection is no longer
  // part of the active category.
  const selectedTemplate =
    visibleTemplates.find(({ name }) => name === requestedTemplateName) ??
    visibleTemplates[0];
  const renderCategoryItem = ({
    id,
    name,
    count,
  }: {
    id: GalleryCategory;
    name: string;
    count: number;
  }) => (
    <ListBoxItem key={id} id={id} textValue={name}>
      <Text size="S">{name}</Text>
      <Counter variant="quiet">{count}</Counter>
    </ListBoxItem>
  );
  const setSelectedCategory = (category: string) => {
    setSearchParams((currentSearchParams) => {
      const nextSearchParams = new URLSearchParams(currentSearchParams);
      if (category === RECOMMENDED_CATEGORY) {
        nextSearchParams.delete(PROJECT_EVALUATOR_CATEGORY_PARAM);
      } else {
        nextSearchParams.set(PROJECT_EVALUATOR_CATEGORY_PARAM, category);
      }
      nextSearchParams.delete(PROJECT_EVALUATOR_TEMPLATE_PARAM);
      return nextSearchParams;
    });
  };
  const setSelectedTemplate = (templateName: string) => {
    setSearchParams((currentSearchParams) => {
      const nextSearchParams = new URLSearchParams(currentSearchParams);
      nextSearchParams.set(PROJECT_EVALUATOR_TEMPLATE_PARAM, templateName);
      return nextSearchParams;
    });
  };

  return (
    <div css={galleryCSS} className="project-evaluator-gallery">
      <nav
        className="project-evaluator-gallery__categories"
        aria-label="Evaluator template categories"
      >
        <ListBox
          aria-label="Evaluator template categories"
          className="project-evaluator-gallery__category-list"
          selectionMode="single"
          selectionBehavior="replace"
          disallowEmptySelection
          selectedKeys={[activeCategory]}
          onSelectionChange={(selection) => {
            if (selection === "all") return;
            const category = selection.keys().next().value;
            if (typeof category === "string") {
              setSelectedCategory(category);
            }
          }}
        >
          <ListBoxSection id="quick-start">
            <Header className="project-evaluator-gallery__category-section-heading">
              <Text elementType="h2" size="XS" weight="heavy" color="text-500">
                Quick start
              </Text>
            </Header>
            {quickStartItems.map(renderCategoryItem)}
          </ListBoxSection>
          <ListBoxSection id="use-cases">
            <Header className="project-evaluator-gallery__category-section-heading">
              <Text elementType="h2" size="XS" weight="heavy" color="text-500">
                Use cases
              </Text>
            </Header>
            {useCaseItems.map(renderCategoryItem)}
          </ListBoxSection>
        </ListBox>
        <EvaluatorScratchActions
          className="project-evaluator-gallery__scratch-actions"
          onCreateLlmEvaluator={() => navigate(paths.galleryNewLlm)}
          onCreateCodeEvaluator={() => navigate(paths.galleryNewCode)}
        />
      </nav>

      <section
        className="project-evaluator-gallery__templates"
        aria-labelledby="evaluator-template-list-title"
      >
        <Select
          aria-label="Evaluator template category"
          className="project-evaluator-gallery__compact-category-select"
          value={activeCategory}
          onChange={(category) => {
            if (typeof category === "string") {
              setSelectedCategory(category);
            }
          }}
        >
          <Button size="S">
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover isNonModal closeOnInteractOutside>
            <ListBox css={compactCategoryListCSS}>
              <ListBoxSection id="compact-quick-start">
                <Header className="project-evaluator-gallery__category-section-heading">
                  <Text
                    elementType="h2"
                    size="XS"
                    weight="heavy"
                    color="text-500"
                  >
                    Quick start
                  </Text>
                </Header>
                {quickStartItems.map(renderCategoryItem)}
              </ListBoxSection>
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
        <Text
          id="evaluator-template-list-title"
          className="project-evaluator-gallery__template-list-title"
          elementType="h2"
          size="S"
          weight="heavy"
        >
          {activeCategoryLabel}
        </Text>
        <ListBox
          aria-labelledby="evaluator-template-list-title"
          className="project-evaluator-gallery__template-list"
          items={visibleTemplates}
          layout="grid"
          selectionMode="single"
          selectionBehavior="replace"
          disallowEmptySelection
          selectedKeys={selectedTemplate ? [selectedTemplate.name] : []}
          onSelectionChange={(selection) => {
            if (selection === "all") return;
            const templateName = selection.keys().next().value;
            if (typeof templateName === "string") {
              setSelectedTemplate(templateName);
            }
          }}
        >
          {(template) => (
            <ListBoxItem
              key={template.name}
              id={template.name}
              textValue={template.name}
            >
              <Flex direction="row" justifyContent="space-between">
                <Text size="S" weight="heavy">
                  {template.name}
                </Text>
                <Badge size="S">LLM</Badge>
              </Flex>
              <LineClamp lines={3}>
                <Text size="XS" color="text-700">
                  {template.description}
                </Text>
              </LineClamp>
            </ListBoxItem>
          )}
        </ListBox>
        <EvaluatorScratchActions
          className="project-evaluator-gallery__compact-scratch-actions"
          onCreateLlmEvaluator={() => navigate(paths.galleryNewLlm)}
          onCreateCodeEvaluator={() => navigate(paths.galleryNewCode)}
        />
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
            No templates are available in this category.
          </Text>
        )}
      </aside>
    </div>
  );
}

function EvaluatorScratchActions({
  className,
  onCreateLlmEvaluator,
  onCreateCodeEvaluator,
}: {
  className: string;
  onCreateLlmEvaluator: () => void;
  onCreateCodeEvaluator: () => void;
}) {
  return (
    <Flex direction="column" gap="size-50" className={className}>
      <Button size="S" variant="quiet" onPress={onCreateLlmEvaluator}>
        Start from a blank prompt
      </Button>
      <Button size="S" variant="quiet" onPress={onCreateCodeEvaluator}>
        Create a code evaluator
      </Button>
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
  return (
    <Flex direction="column" gap="size-200" height="100%">
      <Flex direction="column" gap="size-100">
        <Heading level={2}>{template.name}</Heading>
        <Flex direction="row" gap="size-75" wrap>
          <Badge size="S">LLM</Badge>
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
              Scope
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
          Output choices
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
      <Button variant="primary" onPress={onUseTemplate}>
        Customize this evaluator
      </Button>
    </Flex>
  );
}

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
    --global-dimension-size-3000
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
    flex: 1 1 auto;
    min-height: 0;
    gap: var(--global-dimension-size-100);

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

  .project-evaluator-gallery__category-section-heading {
    padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .project-evaluator-gallery__scratch-actions,
  .project-evaluator-gallery__compact-scratch-actions {
    flex: none;
    padding-top: var(--global-dimension-size-200);
    border-top: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }

  .project-evaluator-gallery__compact-category-select,
  .project-evaluator-gallery__compact-scratch-actions {
    display: none;
  }

  .project-evaluator-gallery__template-list {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(
      auto-fit,
      minmax(var(--project-evaluator-gallery-template-card-min-width), 1fr)
    );
    align-content: start;
    gap: var(--global-dimension-size-100);
    margin-top: var(--global-dimension-size-100);

    .react-aria-ListBoxItem {
      min-height: var(--global-dimension-size-1400);
      gap: var(--global-dimension-size-100);
      margin: 0;
      padding: var(--global-dimension-size-150);
      border: var(--global-border-size-thin) solid
        var(--global-border-color-default);
    }
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

    .project-evaluator-gallery__templates {
      grid-column: 1;
      grid-row: 1;
    }

    .project-evaluator-gallery__template-list-title {
      display: none;
    }

    .project-evaluator-gallery__template-list {
      grid-template-columns: minmax(
        var(--project-evaluator-gallery-template-card-min-width),
        1fr
      );
    }

    .project-evaluator-gallery__compact-scratch-actions {
      display: flex;
      margin-top: var(--global-dimension-size-200);
    }

    .project-evaluator-gallery__details {
      grid-column: 2;
      grid-row: 1;
    }
  }
`;
