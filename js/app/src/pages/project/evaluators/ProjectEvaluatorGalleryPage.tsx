import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay";
import { Outlet, useNavigate } from "react-router";

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
  Skeleton,
  Text,
  View,
} from "@phoenix/components";
import { LineClamp } from "@phoenix/components/core/utility/LineClamp";
import { ErrorBoundary } from "@phoenix/components/exception";
import type { projectEvaluatorTemplatesQuery as ProjectEvaluatorTemplatesQueryType } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import {
  getProjectEvaluatorTemplateCategoryLabel,
  getProjectEvaluatorTemplateChoices,
  type ProjectEvaluatorTemplate,
  projectEvaluatorTemplatesQuery,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTemplates";

const RECOMMENDED_CATEGORY = "Recommended";
const GALLERY_SKELETON_HEIGHT = 440;

export function ProjectEvaluatorGalleryPage() {
  return (
    <View
      elementType="main"
      flex="1 1 auto"
      width="100%"
      height="100%"
      minHeight={GALLERY_SKELETON_HEIGHT}
      overflow="hidden"
    >
      <ErrorBoundary fallback={EvaluatorGalleryError}>
        <Suspense fallback={<EvaluatorGallerySkeleton />}>
          <EvaluatorGallery />
        </Suspense>
      </ErrorBoundary>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </View>
  );
}

function EvaluatorGallery() {
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  const [selectedCategory, setSelectedCategory] =
    useState(RECOMMENDED_CATEGORY);
  const [selectedTemplateName, setSelectedTemplateName] = useState<
    string | null
  >(null);
  const data = useLazyLoadQuery<ProjectEvaluatorTemplatesQueryType>(
    projectEvaluatorTemplatesQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );
  const templates = data.evaluatorGalleryConfigs;
  const categories = Array.from(
    new Set(
      templates.map(({ category }) =>
        getProjectEvaluatorTemplateCategoryLabel(category)
      )
    )
  );
  const recommendedTemplateCount = templates.filter(
    ({ recommended }) => recommended
  ).length;
  const categoryItems = [
    {
      name: RECOMMENDED_CATEGORY,
      count: recommendedTemplateCount,
    },
    ...categories.map((category) => ({
      name: category,
      count: templates.filter(
        ({ category: templateCategory }) =>
          getProjectEvaluatorTemplateCategoryLabel(templateCategory) ===
          category
      ).length,
    })),
  ];
  const activeCategory = categoryItems.some(
    ({ name }) => name === selectedCategory
  )
    ? selectedCategory
    : (categoryItems[0]?.name ?? RECOMMENDED_CATEGORY);
  const visibleTemplates = templates.filter(({ recommended, category }) =>
    activeCategory === RECOMMENDED_CATEGORY
      ? recommended
      : getProjectEvaluatorTemplateCategoryLabel(category) === activeCategory
  );
  const selectedTemplate =
    visibleTemplates.find(({ name }) => name === selectedTemplateName) ??
    visibleTemplates[0];

  return (
    <div css={galleryCSS} className="project-evaluator-gallery">
      <nav
        className="project-evaluator-gallery__categories"
        aria-label="Evaluator template categories"
      >
        <Text
          id="evaluator-template-category-list-title"
          elementType="h2"
          size="S"
          weight="heavy"
        >
          Category
        </Text>
        <ListBox
          aria-labelledby="evaluator-template-category-list-title"
          className="project-evaluator-gallery__category-list"
          items={categoryItems}
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
          {({ name, count }) => (
            <ListBoxItem key={name} id={name} textValue={name}>
              {({ isSelected }) => (
                <>
                  <Text size="S">{name}</Text>
                  <Counter variant={isSelected ? "quiet" : "default"}>
                    {count}
                  </Counter>
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
        <Flex
          direction="column"
          gap="size-50"
          className="project-evaluator-gallery__scratch-actions"
        >
          <Button
            size="S"
            variant="quiet"
            onPress={() => navigate(paths.galleryNewLlm)}
          >
            Start from a blank prompt
          </Button>
          <Button
            size="S"
            variant="quiet"
            onPress={() => navigate(paths.galleryNewCode)}
          >
            Create a code evaluator
          </Button>
        </Flex>
      </nav>

      <section
        className="project-evaluator-gallery__templates"
        aria-labelledby="evaluator-template-list-title"
      >
        <Text
          id="evaluator-template-list-title"
          elementType="h2"
          size="S"
          weight="heavy"
        >
          {activeCategory}
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
              setSelectedTemplateName(templateName);
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

function EvaluatorTemplateDetails({
  template,
  onUseTemplate,
}: {
  template: ProjectEvaluatorTemplate;
  onUseTemplate: () => void;
}) {
  const choices = getProjectEvaluatorTemplateChoices(template);
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
        <Text size="S" color="text-700">
          {template.description}
        </Text>
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
                  {score}
                </Text>
              </Flex>
            </ListItem>
          ))}
        </List>
      </Flex>
      <Button
        variant="primary"
        onPress={onUseTemplate}
        css={css`
          margin-top: auto;
        `}
      >
        Use this evaluator
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

const galleryCSS = css`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(160px, 0.65fr) minmax(320px, 1.5fr) minmax(
      260px,
      1fr
    );
  height: 100%;
  min-height: ${GALLERY_SKELETON_HEIGHT}px;
  overflow: hidden;
  background-color: var(--global-background-color-default);

  .project-evaluator-gallery__categories,
  .project-evaluator-gallery__templates,
  .project-evaluator-gallery__details {
    min-height: 0;
    padding: var(--global-dimension-size-200);
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
    border-right: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }

  .project-evaluator-gallery__category-list {
    flex: 1 1 auto;
    min-height: 0;
    margin-top: var(--global-dimension-size-100);

    .react-aria-ListBoxItem {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: var(--global-dimension-size-100);
    }
  }

  .project-evaluator-gallery__scratch-actions {
    flex: none;
    padding-top: var(--global-dimension-size-200);
    border-top: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }

  .project-evaluator-gallery__template-list {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
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

  @media (max-width: 900px) {
    overflow-x: hidden;
    overflow-y: auto;
    grid-template-columns: minmax(160px, 0.65fr) minmax(320px, 1.5fr);

    .project-evaluator-gallery__categories,
    .project-evaluator-gallery__templates,
    .project-evaluator-gallery__details {
      min-height: auto;
      overflow: visible;
    }

    .project-evaluator-gallery__category-list,
    .project-evaluator-gallery__template-list {
      flex: none;
      overflow: visible;
    }

    .project-evaluator-gallery__templates {
      border-right: 0;
    }

    .project-evaluator-gallery__details {
      grid-column: 1 / -1;
      border-top: var(--global-border-size-thin) solid
        var(--global-border-color-default);
    }
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;

    .project-evaluator-gallery__categories,
    .project-evaluator-gallery__templates {
      border-right: 0;
      border-bottom: var(--global-border-size-thin) solid
        var(--global-border-color-default);
    }

    .project-evaluator-gallery__details {
      grid-column: auto;
      border-top: 0;
    }
  }
`;
