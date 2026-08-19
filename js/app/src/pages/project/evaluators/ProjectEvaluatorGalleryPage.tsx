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
  Skeleton,
  Text,
} from "@phoenix/components";
import { LineClamp } from "@phoenix/components/core/utility/LineClamp";
import { ErrorBoundary } from "@phoenix/components/exception";
import type { projectEvaluatorTemplatesQuery as ProjectEvaluatorTemplatesQueryType } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import {
  getProjectEvaluatorTemplateCategoryLabel,
  getProjectEvaluatorTemplateChoices,
  getProjectEvaluatorTemplateMetadata,
  type ProjectEvaluatorTemplate,
  projectEvaluatorTemplatesQuery,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTemplates";

const RECOMMENDED_CATEGORY = "Recommended";
const GALLERY_SKELETON_HEIGHT = 440;

type TemplateWithMetadata = {
  config: ProjectEvaluatorTemplate;
  metadata: ReturnType<typeof getProjectEvaluatorTemplateMetadata>;
};

export function ProjectEvaluatorGalleryPage() {
  return (
    <main css={galleryOuterCSS}>
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
  const templates: TemplateWithMetadata[] =
    data.classificationEvaluatorConfigs.map((config) => ({
      config,
      metadata: getProjectEvaluatorTemplateMetadata(config.name),
    }));
  const categories = Array.from(
    new Set(
      templates.map(({ metadata }) =>
        getProjectEvaluatorTemplateCategoryLabel(metadata.category)
      )
    )
  );
  const recommendedTemplateCount = templates.filter(
    ({ metadata }) => metadata.recommended
  ).length;
  const categoryItems = [
    {
      name: RECOMMENDED_CATEGORY,
      count: recommendedTemplateCount,
    },
    ...categories.map((category) => ({
      name: category,
      count: templates.filter(
        ({ metadata }) =>
          getProjectEvaluatorTemplateCategoryLabel(metadata.category) ===
          category
      ).length,
    })),
  ];
  const activeCategory = categoryItems.some(
    ({ name }) => name === selectedCategory
  )
    ? selectedCategory
    : (categoryItems[0]?.name ?? RECOMMENDED_CATEGORY);
  const visibleTemplates = templates.filter(({ metadata }) =>
    activeCategory === RECOMMENDED_CATEGORY
      ? metadata.recommended
      : getProjectEvaluatorTemplateCategoryLabel(metadata.category) ===
        activeCategory
  );
  const selectedTemplate =
    visibleTemplates.find(
      ({ config }) => config.name === selectedTemplateName
    ) ?? visibleTemplates[0];

  return (
    <div css={galleryCSS} className="project-evaluator-gallery">
      <nav
        className="project-evaluator-gallery__categories"
        aria-label="Evaluator template categories"
      >
        <Heading level={2} css={sectionHeadingCSS}>
          Use case
        </Heading>
        <ul className="project-evaluator-gallery__category-list">
          {categoryItems.map(({ name, count }) => {
            const isSelected = name === activeCategory;
            return (
              <li key={name}>
                <button
                  className="project-evaluator-gallery__category-button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCategory(name)}
                >
                  <Text size="S">{name}</Text>
                  <Counter variant={isSelected ? "quiet" : "default"}>
                    {count}
                  </Counter>
                </button>
              </li>
            );
          })}
        </ul>
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
        <Heading
          id="evaluator-template-list-title"
          level={2}
          css={sectionHeadingCSS}
        >
          {activeCategory}
        </Heading>
        <ul className="project-evaluator-gallery__template-list">
          {visibleTemplates.map(({ config, metadata }) => {
            const isSelected = config.name === selectedTemplate?.config.name;
            return (
              <li key={config.name}>
                <button
                  className="project-evaluator-gallery__template-card"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedTemplateName(config.name)}
                >
                  <Flex direction="row" justifyContent="space-between">
                    <Text size="S" weight="heavy">
                      {config.name}
                    </Text>
                    <Badge size="S">{metadata.kind}</Badge>
                  </Flex>
                  <LineClamp lines={3}>
                    <Text size="XS" color="text-700">
                      {config.description}
                    </Text>
                  </LineClamp>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="project-evaluator-gallery__details" aria-live="polite">
        {selectedTemplate ? (
          <EvaluatorTemplateDetails
            template={selectedTemplate}
            onUseTemplate={() =>
              navigate(
                paths.galleryNewLlmFromTemplate(selectedTemplate.config.name)
              )
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
  template: TemplateWithMetadata;
  onUseTemplate: () => void;
}) {
  const { config, metadata } = template;
  const choices = getProjectEvaluatorTemplateChoices(config);
  return (
    <Flex direction="column" gap="size-200" height="100%">
      <Flex direction="column" gap="size-100">
        <Heading level={2}>{config.name}</Heading>
        <Flex direction="row" gap="size-75" wrap>
          <Badge size="S">{metadata.kind}</Badge>
          <Badge size="S">
            {getProjectEvaluatorTemplateCategoryLabel(metadata.category)}
          </Badge>
        </Flex>
        <Text size="S" color="text-700">
          {config.description}
        </Text>
        {metadata.details ? (
          <Text size="S" color="text-700">
            {metadata.details}
          </Text>
        ) : null}
      </Flex>
      <dl className="project-evaluator-gallery__definition-list">
        <div>
          <dt>Scope</dt>
          <dd>
            {metadata.scope ? capitalize(metadata.scope.toLowerCase()) : "—"}
          </dd>
        </div>
        <div>
          <dt>Optimization</dt>
          <dd>{capitalize(config.optimizationDirection.toLowerCase())}</dd>
        </div>
      </dl>
      <Flex direction="column" gap="size-75">
        <Heading level={3} css={sectionHeadingCSS}>
          Output choices
        </Heading>
        <ul className="project-evaluator-gallery__choice-list">
          {choices.map(({ label, score }) => (
            <li key={label}>
              <Text size="S">{label}</Text>
              <Text size="XS" color="text-500">
                {score}
              </Text>
            </li>
          ))}
        </ul>
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
    padding: var(--global-dimension-size-200);
  }

  .project-evaluator-gallery__categories {
    display: flex;
    flex-direction: column;
  }

  .project-evaluator-gallery__categories,
  .project-evaluator-gallery__templates {
    border-right: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }

  .project-evaluator-gallery__category-list,
  .project-evaluator-gallery__template-list,
  .project-evaluator-gallery__choice-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .project-evaluator-gallery__category-list {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-50);
    margin-top: var(--global-dimension-size-100);
  }

  .project-evaluator-gallery__scratch-actions {
    margin-top: auto;
    padding-top: var(--global-dimension-size-200);
    border-top: var(--global-border-size-thin) solid
      var(--global-border-color-default);
  }

  .project-evaluator-gallery__category-button,
  .project-evaluator-gallery__template-card {
    width: 100%;
    border: var(--global-border-size-thin) solid transparent;
    border-radius: var(--global-rounding-small);
    background-color: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;

    &:hover {
      background-color: var(--global-list-item-hover-background-color);
    }

    &:focus-visible {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }

    &[aria-pressed="true"] {
      border-color: var(--global-border-color-default);
      background-color: var(--global-list-item-selected-background-color);
    }
  }

  .project-evaluator-gallery__category-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-75) var(--global-dimension-size-100);
  }

  .project-evaluator-gallery__template-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: var(--global-dimension-size-100);
    margin-top: var(--global-dimension-size-100);
  }

  .project-evaluator-gallery__template-card {
    display: flex;
    min-height: var(--global-dimension-size-1400);
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-150);
    border-color: var(--global-border-color-default);
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

    dt {
      color: var(--global-text-color-500);
      font-size: var(--global-font-size-xs);
    }

    dd {
      margin: 0;
      font-size: var(--global-font-size-s);
    }
  }

  .project-evaluator-gallery__choice-list {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-50);

    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--global-dimension-size-100);
      padding-bottom: var(--global-dimension-size-50);
      border-bottom: var(--global-border-size-thin) solid
        var(--global-border-color-default);
    }
  }

  @media (max-width: 900px) {
    overflow-x: hidden;
    overflow-y: auto;
    grid-template-columns: minmax(160px, 0.65fr) minmax(320px, 1.5fr);

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

const galleryOuterCSS = css`
  box-sizing: border-box;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: ${GALLERY_SKELETON_HEIGHT}px;
  overflow: hidden;
`;

const sectionHeadingCSS = css`
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
  font-weight: 600;
`;
