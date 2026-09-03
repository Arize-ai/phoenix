import { css } from "@emotion/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Header, ListBoxSection } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Outlet, useNavigate, useParams, useSearchParams } from "react-router";

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
import {
  PythonBlockWithCopy,
  TypeScriptBlockWithCopy,
} from "@phoenix/components/code";
import { LineClamp } from "@phoenix/components/core/utility/LineClamp";
import { EvaluatorKindToken } from "@phoenix/components/evaluators/EvaluatorKindToken";
import { ErrorBoundary } from "@phoenix/components/exception";
import {
  PROJECT_EVALUATOR_CATEGORY_PARAM,
  PROJECT_EVALUATOR_PARAM,
  PROJECT_EVALUATOR_TEMPLATE_PARAM,
} from "@phoenix/constants/searchParams";
import type { projectEvaluatorDetailsQuery as ProjectEvaluatorDetailsQueryType } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorDetailsQuery.graphql";
import type { projectEvaluatorGalleryPageQuery as ProjectEvaluatorGalleryPageQueryType } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorGalleryPageQuery.graphql";
import type { EvaluatorCategory } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorTemplatesQuery.graphql";
import { AddProjectEvaluatorMenu } from "@phoenix/pages/project/evaluators/AddProjectEvaluatorMenu";
import { EvaluatorTemplateCard } from "@phoenix/pages/project/evaluators/EvaluatorTemplateCard";
import {
  projectEvaluatorDetailsQueryNode,
  readProjectEvaluatorDetails,
  type CodeProjectEvaluatorDetails,
  type LlmProjectEvaluatorDetails,
} from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";
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
} from "@phoenix/pages/project/evaluators/projectEvaluatorTemplates";
import {
  formatEvaluationTargetPlural,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { PlaygroundChatTemplate } from "@phoenix/store";
import { convertPromptVersionMessagesToPlaygroundInstanceMessages } from "@phoenix/utils/promptUtils";

const OTHER_CATEGORY = "other" as const;
const CUSTOM_EVALUATORS_SECTION = "custom-evaluators" as const;
const GALLERY_SKELETON_HEIGHT = 440;
/** The combined minimum width of the category, template, and details columns. */
const GALLERY_EXPANDED_MIN_WIDTH = 960;
/**
 * Once a category heading crosses into the top 30% of the scroll region, treat
 * it as the section the user is currently reading.
 */
const SCROLL_SPY_ROOT_MARGIN = "0px 0px -70% 0px";

type TemplateCategory = EvaluatorCategory | typeof OTHER_CATEGORY;
type GallerySection = TemplateCategory | typeof CUSTOM_EVALUATORS_SECTION;

type CustomEvaluator = {
  readonly __typename: "LLMEvaluator" | "CodeEvaluator";
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
};

type GalleryItem =
  | { kind: "custom"; evaluator: CustomEvaluator }
  | { kind: "template"; template: ProjectEvaluatorTemplate };

const projectEvaluatorGalleryPageQuery = graphql`
  query projectEvaluatorGalleryPageQuery($projectId: ID!) {
    evaluatorGalleryConfigs {
      name
      description
      choices
      optimizationDirection
      scope
      category
      details
      inputs {
        name
        description
      }
      messages {
        ...promptUtils_promptMessages
      }
    }
    evaluators(
      first: 100
      sort: { col: updatedAt, dir: desc }
      excludeProjectId: $projectId
    )
      @connection(
        key: "ProjectEvaluatorGallery__evaluators"
        filters: ["excludeProjectId"]
      ) {
      edges {
        evaluator: node {
          __typename
          id
          name
          description
        }
      }
    }
  }
`;

function getGalleryCategory(
  category: EvaluatorCategory | null
): TemplateCategory {
  return category ?? OTHER_CATEGORY;
}

function getSectionHeadingId(section: GallerySection): string {
  return `project-evaluator-gallery-section-${section.toLowerCase()}`;
}

const getCustomEvaluatorItemKey = (id: string) => `custom:${id}`;
const getTemplateItemKey = (name: string) => `template:${name}`;
const getCustomEvaluatorKind = (evaluator: CustomEvaluator) =>
  evaluator.__typename === "LLMEvaluator" ? "LLM" : "CODE";

function getGalleryItemKey(item: GalleryItem): string {
  return item.kind === "custom"
    ? getCustomEvaluatorItemKey(item.evaluator.id)
    : getTemplateItemKey(item.template.name);
}

function getGalleryItemSection(item: GalleryItem): GallerySection {
  return item.kind === "custom"
    ? CUSTOM_EVALUATORS_SECTION
    : getGalleryCategory(item.template.category);
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
  const { projectId } = useParams();
  if (!projectId) {
    throw new Error("projectId is required");
  }
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useLazyLoadQuery<ProjectEvaluatorGalleryPageQueryType>(
    projectEvaluatorGalleryPageQuery,
    { projectId },
    { fetchPolicy: "store-and-network" }
  );
  const templates = data.evaluatorGalleryConfigs;
  const customEvaluators = useMemo(
    () =>
      data.evaluators.edges
        .map(({ evaluator }) => evaluator)
        .filter(
          (evaluator): evaluator is CustomEvaluator =>
            evaluator.__typename === "LLMEvaluator" ||
            evaluator.__typename === "CodeEvaluator"
        ),
    [data.evaluators.edges]
  );
  const hasCustomEvaluators = customEvaluators.length > 0;
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
  const galleryItems: GalleryItem[] = [
    ...customEvaluators.map((evaluator) => ({
      kind: "custom" as const,
      evaluator,
    })),
    ...templates.map((template) => ({
      kind: "template" as const,
      template,
    })),
  ];
  const galleryItemsByKey = new Map(
    galleryItems.map((item) => [getGalleryItemKey(item), item])
  );
  const sections = useMemo<GallerySection[]>(
    () =>
      hasCustomEvaluators
        ? [CUSTOM_EVALUATORS_SECTION, ...categories]
        : categories,
    [categories, hasCustomEvaluators]
  );
  const categoryItems = categories.map((category) => ({
    id: category,
    name: getProjectEvaluatorTemplateCategoryLabel(
      category === OTHER_CATEGORY ? null : category
    ),
    count: templatesByCategory.get(category)?.length ?? 0,
  }));
  const requestedTemplateName = searchParams.get(
    PROJECT_EVALUATOR_TEMPLATE_PARAM
  );
  const requestedEvaluatorId = searchParams.get(PROJECT_EVALUATOR_PARAM);
  const requestedCategoryParam = searchParams.get(
    PROJECT_EVALUATOR_CATEGORY_PARAM
  ) as TemplateCategory | null;
  const requestedCategory =
    requestedCategoryParam && categories.includes(requestedCategoryParam)
      ? requestedCategoryParam
      : undefined;

  // URL selections are optional deep links. Resolve them through the same item
  // index that backs card selection so invalid or stale values are harmless.
  let requestedItem: GalleryItem | undefined;
  if (requestedEvaluatorId) {
    requestedItem = galleryItemsByKey.get(
      getCustomEvaluatorItemKey(requestedEvaluatorId)
    );
  }
  if (!requestedItem && requestedTemplateName) {
    requestedItem = galleryItemsByKey.get(
      getTemplateItemKey(requestedTemplateName)
    );
  }

  const requestedItemKeyToScroll = requestedItem
    ? getGalleryItemKey(requestedItem)
    : undefined;
  const requestedSectionToScroll = requestedItem
    ? getGalleryItemSection(requestedItem)
    : requestedCategory;
  const requestedCategoryTemplate = requestedCategory
    ? templatesByCategory.get(requestedCategory)?.[0]
    : undefined;
  const requestedCategoryItem: GalleryItem | undefined =
    requestedCategoryTemplate
      ? { kind: "template", template: requestedCategoryTemplate }
      : undefined;

  // Prefer deep-linked content, then fall back to the first available card.
  const selectedItem =
    requestedItem ?? requestedCategoryItem ?? galleryItems[0];
  const selectedItemKey = selectedItem
    ? getGalleryItemKey(selectedItem)
    : undefined;

  // Section headings double as scroll-spy targets, so the sidebar can track
  // whichever gallery section is currently in view.
  const headingRefs = useRef(new Map<GallerySection, HTMLElement>());
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const galleryScrollRegionRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<
    GallerySection | undefined
  >(() => requestedSectionToScroll ?? sections[0]);
  const selectedSection =
    activeSection && sections.includes(activeSection)
      ? activeSection
      : sections[0];

  const scrollToSection = (section: GallerySection) => {
    headingRefs.current.get(section)?.scrollIntoView({ block: "start" });
    setActiveSection(section);
  };

  // Keep the scroll position synchronized with gallery deep links. Prefer the
  // requested card and fall back to its section when no card is available.
  useEffect(() => {
    // Wait for the route commit and React Aria collection layout before moving
    // the scroll port; otherwise router scroll restoration can win this race.
    const animationFrameId = requestAnimationFrame(() => {
      const requestedCard = requestedItemKeyToScroll
        ? cardRefs.current.get(requestedItemKeyToScroll)
        : undefined;
      const requestedSectionHeading = requestedSectionToScroll
        ? headingRefs.current.get(requestedSectionToScroll)
        : undefined;
      const scrollTarget = requestedCard ?? requestedSectionHeading;
      scrollTarget?.scrollIntoView({
        block: requestedCard ? "nearest" : "start",
      });
      if (requestedSectionToScroll) {
        setActiveSection(requestedSectionToScroll);
      }
    });
    return () => cancelAnimationFrame(animationFrameId);
  }, [requestedItemKeyToScroll, requestedSectionToScroll]);

  useEffect(() => {
    let observer: IntersectionObserver | undefined;
    // Wait for React Aria to mount its collection headings before snapshotting
    // the refs used by the scroll spy.
    const animationFrameId = requestAnimationFrame(() => {
      const scrollRegion = galleryScrollRegionRef.current;
      if (!scrollRegion) return;
      // Snapshot the mounted headings so observer entries can be mapped back to
      // the category selection used by the sidebar and compact picker.
      const headingsByElement = new Map<Element, GallerySection>(
        sections
          .map(
            (section) => [headingRefs.current.get(section), section] as const
          )
          .filter(
            (entry): entry is [HTMLElement, GallerySection] => entry[0] != null
          )
      );
      if (headingsByElement.size === 0) return;
      const createdObserver = new IntersectionObserver(
        (entries) => {
          // More than one heading can occupy the active top band. The uppermost
          // one represents the category the user is currently reading.
          const topmostVisibleEntry = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
            .at(0);
          // The final heading cannot reach the top band when the scroll port is
          // at its limit, so treat the bottom as belonging to the last category.
          const isAtScrollEnd =
            scrollRegion.scrollTop + scrollRegion.clientHeight >=
            scrollRegion.scrollHeight - 1;
          const section = isAtScrollEnd
            ? sections.at(-1)
            : topmostVisibleEntry
              ? headingsByElement.get(topmostVisibleEntry.target)
              : undefined;
          if (section) {
            setActiveSection(section);
          }
        },
        { root: scrollRegion, rootMargin: SCROLL_SPY_ROOT_MARGIN }
      );
      observer = createdObserver;
      // Observe every mounted category heading and release them together when
      // the category collection changes or the gallery unmounts.
      headingsByElement.forEach((_section, heading) =>
        createdObserver.observe(heading)
      );
    });
    return () => {
      cancelAnimationFrame(animationFrameId);
      observer?.disconnect();
    };
  }, [sections]);

  const setSelectedItem = (item: GalleryItem) => {
    setSearchParams((currentSearchParams) => {
      const nextSearchParams = new URLSearchParams(currentSearchParams);
      if (item.kind === "custom") {
        nextSearchParams.set(PROJECT_EVALUATOR_PARAM, item.evaluator.id);
        nextSearchParams.delete(PROJECT_EVALUATOR_CATEGORY_PARAM);
        nextSearchParams.delete(PROJECT_EVALUATOR_TEMPLATE_PARAM);
      } else {
        nextSearchParams.set(
          PROJECT_EVALUATOR_CATEGORY_PARAM,
          getGalleryCategory(item.template.category)
        );
        nextSearchParams.set(
          PROJECT_EVALUATOR_TEMPLATE_PARAM,
          item.template.name
        );
        nextSearchParams.delete(PROJECT_EVALUATOR_PARAM);
      }
      return nextSearchParams;
    });
  };
  const renderSectionItem = ({
    id,
    name,
    count,
  }: {
    id: GallerySection;
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
            aria-label="Evaluator gallery sections"
            className="project-evaluator-gallery__category-list"
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
            selectedKeys={selectedSection ? [selectedSection] : []}
            onSelectionChange={(selection) => {
              if (selection === "all") return;
              const section = selection.keys().next().value;
              if (typeof section === "string") {
                scrollToSection(section as GallerySection);
              }
            }}
          >
            {hasCustomEvaluators ? (
              <ListBoxSection id="custom-evaluators-navigation">
                {renderSectionItem({
                  id: CUSTOM_EVALUATORS_SECTION,
                  name: "Custom evaluators",
                  count: customEvaluators.length,
                })}
              </ListBoxSection>
            ) : null}
            <ListBoxSection id="categories">
              <Header className="project-evaluator-gallery__category-section-heading">
                <Text
                  elementType="h2"
                  size="XS"
                  weight="heavy"
                  color="text-500"
                >
                  Categories
                </Text>
              </Header>
              {categoryItems.map(renderSectionItem)}
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
          aria-label="Evaluator gallery section"
          className="project-evaluator-gallery__compact-category-select"
          value={selectedSection}
          onChange={(section) => {
            if (typeof section === "string") {
              scrollToSection(section as GallerySection);
            }
          }}
        >
          <Button size="S">
            <SelectValue />
            <SelectChevronUpDownIcon />
          </Button>
          <Popover isNonModal closeOnInteractOutside>
            <ListBox css={compactCategoryListCSS}>
              {hasCustomEvaluators ? (
                <ListBoxSection id="compact-custom-evaluators">
                  {renderSectionItem({
                    id: CUSTOM_EVALUATORS_SECTION,
                    name: "Custom evaluators",
                    count: customEvaluators.length,
                  })}
                </ListBoxSection>
              ) : null}
              <ListBoxSection id="compact-categories">
                <Header className="project-evaluator-gallery__category-section-heading">
                  <Text
                    elementType="h2"
                    size="XS"
                    weight="heavy"
                    color="text-500"
                  >
                    Categories
                  </Text>
                </Header>
                {categoryItems.map(renderSectionItem)}
              </ListBoxSection>
            </ListBox>
          </Popover>
        </Select>
        <ListBox
          ref={galleryScrollRegionRef}
          aria-label="Evaluators and templates"
          className="project-evaluator-gallery__template-card-scroll-region"
          layout="grid"
          selectionMode="single"
          selectionBehavior="replace"
          selectedKeys={selectedItemKey ? [selectedItemKey] : []}
          onSelectionChange={(selection) => {
            if (selection === "all") return;
            const itemKey = selection.keys().next().value;
            if (typeof itemKey === "string") {
              const item = galleryItemsByKey.get(itemKey);
              if (item) {
                setSelectedItem(item);
              }
            }
          }}
          onAction={(key) => {
            if (typeof key !== "string") return;
            const item = galleryItemsByKey.get(key);
            if (item?.kind === "custom") {
              navigate(
                getCustomEvaluatorKind(item.evaluator) === "LLM"
                  ? paths.galleryCreation.copyLlm(item.evaluator.id)
                  : paths.galleryCreation.attachCode(item.evaluator.id)
              );
              return;
            }
            if (item?.kind === "template") {
              navigate(paths.galleryNewLlmFromTemplate(item.template.name));
            }
          }}
        >
          {hasCustomEvaluators ? (
            <ListBoxSection
              id={CUSTOM_EVALUATORS_SECTION}
              className="project-evaluator-gallery__template-category-section"
            >
              <Header className="project-evaluator-gallery__template-category-header">
                <Text
                  ref={(element) => {
                    if (element) {
                      headingRefs.current.set(
                        CUSTOM_EVALUATORS_SECTION,
                        element
                      );
                    } else {
                      headingRefs.current.delete(CUSTOM_EVALUATORS_SECTION);
                    }
                  }}
                  id={getSectionHeadingId(CUSTOM_EVALUATORS_SECTION)}
                  className="project-evaluator-gallery__template-category-heading"
                  elementType="h2"
                  size="M"
                  weight="heavy"
                >
                  Custom evaluators
                </Text>
              </Header>
              {customEvaluators.map((evaluator) => {
                const itemKey = getCustomEvaluatorItemKey(evaluator.id);
                return (
                  <EvaluatorTemplateCard
                    key={itemKey}
                    ref={(element) => {
                      if (element) {
                        cardRefs.current.set(itemKey, element);
                      } else {
                        cardRefs.current.delete(itemKey);
                      }
                    }}
                    id={itemKey}
                    textValue={evaluator.name}
                  >
                    <Text size="S" weight="heavy">
                      {evaluator.name}
                    </Text>
                    <LineClamp lines={3}>
                      <Text size="XS" color="text-700">
                        {evaluator.description || "No description"}
                      </Text>
                    </LineClamp>
                    <EvaluatorTemplateCardFooter
                      evaluatorKind={getCustomEvaluatorKind(evaluator)}
                    />
                  </EvaluatorTemplateCard>
                );
              })}
            </ListBoxSection>
          ) : null}
          {categories.map((category) => {
            const headingId = getSectionHeadingId(category);
            return (
              <ListBoxSection
                key={category}
                id={category}
                className="project-evaluator-gallery__template-category-section"
              >
                <Header className="project-evaluator-gallery__template-category-header">
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
                </Header>
                {(templatesByCategory.get(category) ?? []).map((template) => (
                  <EvaluatorTemplateCard
                    key={getTemplateItemKey(template.name)}
                    ref={(element) => {
                      if (element) {
                        cardRefs.current.set(
                          getTemplateItemKey(template.name),
                          element
                        );
                      } else {
                        cardRefs.current.delete(
                          getTemplateItemKey(template.name)
                        );
                      }
                    }}
                    id={getTemplateItemKey(template.name)}
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
                ))}
              </ListBoxSection>
            );
          })}
        </ListBox>
      </section>

      <aside className="project-evaluator-gallery__details" aria-live="polite">
        {selectedItem?.kind === "custom" ? (
          <ErrorBoundary
            key={selectedItem.evaluator.id}
            fallback={EvaluatorDetailsError}
          >
            <Suspense fallback={<EvaluatorDetailsSkeleton />}>
              <CustomEvaluatorDetails
                evaluator={selectedItem.evaluator}
                onAttachCodeEvaluator={() =>
                  navigate(
                    paths.galleryCreation.attachCode(selectedItem.evaluator.id)
                  )
                }
                onDuplicateEvaluator={() =>
                  navigate(
                    getCustomEvaluatorKind(selectedItem.evaluator) === "LLM"
                      ? paths.galleryCreation.copyLlm(selectedItem.evaluator.id)
                      : paths.galleryCreation.copyCode(
                          selectedItem.evaluator.id
                        )
                  )
                }
              />
            </Suspense>
          </ErrorBoundary>
        ) : selectedItem?.kind === "template" ? (
          <EvaluatorTemplateDetails
            template={selectedItem.template}
            onUseTemplate={() =>
              navigate(
                paths.galleryNewLlmFromTemplate(selectedItem.template.name)
              )
            }
          />
        ) : (
          <Text size="S" color="text-500">
            No evaluators or templates are available in the gallery.
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
  evaluationTargets?: readonly [
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
      {evaluationTargets ? (
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
      ) : null}
    </Flex>
  );
}

function CustomEvaluatorDetails({
  evaluator: evaluatorSummary,
  onAttachCodeEvaluator,
  onDuplicateEvaluator,
}: {
  evaluator: CustomEvaluator;
  onAttachCodeEvaluator: () => void;
  onDuplicateEvaluator: () => void;
}) {
  const data = useLazyLoadQuery<ProjectEvaluatorDetailsQueryType>(
    projectEvaluatorDetailsQueryNode,
    { id: evaluatorSummary.id },
    { fetchPolicy: "store-and-network" }
  );
  const evaluator = readProjectEvaluatorDetails(data.evaluator);
  if (!evaluator) {
    return <EvaluatorDetailsError />;
  }
  if (evaluator.__typename === "LLMEvaluator") {
    return (
      <LlmCustomEvaluatorDetails
        evaluator={evaluator}
        onDuplicateEvaluator={onDuplicateEvaluator}
      />
    );
  }
  if (evaluator.__typename === "CodeEvaluator") {
    return (
      <CodeCustomEvaluatorDetails
        evaluator={evaluator}
        onAttachCodeEvaluator={onAttachCodeEvaluator}
        onDuplicateEvaluator={onDuplicateEvaluator}
      />
    );
  }
  return <EvaluatorDetailsError />;
}

function CustomEvaluatorDetailsHeader({
  evaluator,
}: {
  evaluator: LlmProjectEvaluatorDetails | CodeProjectEvaluatorDetails;
}) {
  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>{evaluator.name}</Heading>
      <Flex direction="row" gap="size-75" wrap>
        <EvaluatorKindToken
          kind={evaluator.__typename === "LLMEvaluator" ? "LLM" : "CODE"}
          size="S"
        />
      </Flex>
      <Text
        size="S"
        color={evaluator.description ? "text-700" : "text-500"}
        css={evaluator.description ? undefined : emptyDescriptionCSS}
      >
        {evaluator.description || "No description"}
      </Text>
    </Flex>
  );
}

function EvaluatorOutputSummary({
  outputConfigs,
}: {
  outputConfigs: LlmProjectEvaluatorDetails["outputConfigs"];
}) {
  const supportedOutputConfigs = outputConfigs.filter(
    (config) => config.__typename !== "%other"
  );
  if (supportedOutputConfigs.length === 0) return null;
  return (
    <Flex direction="column" gap="size-200">
      {supportedOutputConfigs.map((config) => (
        <Flex key={config.name} direction="column" gap="size-100">
          {supportedOutputConfigs.length > 1 ? (
            <Text elementType="h3" size="S" weight="heavy">
              {config.name}
            </Text>
          ) : null}
          <dl className="project-evaluator-gallery__definition-list">
            <div>
              <dt>
                <Text size="XS" color="text-500">
                  Optimization
                </Text>
              </dt>
              <dd>
                <Text size="S">
                  {capitalize(config.optimizationDirection.toLowerCase())}
                </Text>
              </dd>
            </div>
          </dl>
          {config.__typename === "CategoricalAnnotationConfig" &&
          config.values.length > 0 ? (
            <AnnotationValues
              values={config.values}
              optimizationDirection={config.optimizationDirection}
            />
          ) : null}
        </Flex>
      ))}
    </Flex>
  );
}

type EvaluatorInputSummaryItem = {
  readonly name: string;
  readonly description?: string;
};

function EvaluatorInputSummary({
  inputs,
}: {
  inputs: readonly EvaluatorInputSummaryItem[];
}) {
  if (inputs.length === 0) return null;
  return (
    <Flex direction="column" gap="size-75">
      <Text elementType="h3" size="S" weight="heavy">
        Inputs
      </Text>
      <div css={[detailsSectionWellCSS, listSectionWellCSS]}>
        <List size="S">
          {inputs.map((input) => (
            <ListItem key={input.name}>
              <Flex direction="column" gap="size-25">
                <Text size="S" fontFamily="mono" css={inputNameCSS}>
                  {input.name}
                </Text>
                {input.description ? (
                  <Text size="XS" color="text-700">
                    {input.description}
                  </Text>
                ) : null}
              </Flex>
            </ListItem>
          ))}
        </List>
      </div>
    </Flex>
  );
}

function AnnotationValues({
  values,
  optimizationDirection,
}: {
  values: ReadonlyArray<{
    readonly label: string;
    readonly score: number | null;
  }>;
  optimizationDirection: string;
}) {
  const optimizationBounds = getOptimizationBounds({
    annotationType: "CATEGORICAL",
    optimizationDirection,
    values,
  });
  return (
    <Flex direction="column" gap="size-75">
      <Text elementType="h3" size="S" weight="heavy">
        Annotation values
      </Text>
      <div css={[detailsSectionWellCSS, listSectionWellCSS]}>
        <List size="S">
          {values.map(({ label, score }) => (
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
                    {score ?? "—"}
                  </AnnotationScoreText>
                </Text>
              </Flex>
            </ListItem>
          ))}
        </List>
      </div>
    </Flex>
  );
}

function LlmCustomEvaluatorDetails({
  evaluator,
  onDuplicateEvaluator,
}: {
  evaluator: LlmProjectEvaluatorDetails;
  onDuplicateEvaluator: () => void;
}) {
  const promptTemplate = evaluator.promptVersion?.template;
  const messages: PlaygroundChatTemplate["messages"] =
    promptTemplate?.__typename === "PromptChatTemplate"
      ? convertPromptVersionMessagesToPlaygroundInstanceMessages({
          promptMessagesRefs: promptTemplate.messages,
        })
      : promptTemplate?.__typename === "PromptStringTemplate"
        ? [
            {
              id: 0,
              role: "user",
              content: promptTemplate.template,
            },
          ]
        : [];
  return (
    <Flex direction="column" gap="size-200" height="100%">
      <CustomEvaluatorDetailsHeader evaluator={evaluator} />
      <EvaluatorOutputSummary outputConfigs={evaluator.outputConfigs} />
      <EvaluatorInputSummary inputs={evaluator.inputs} />
      <EvaluatorPromptPreview messages={messages} />
      <EvaluatorDetailsAction onPress={onDuplicateEvaluator}>
        Duplicate this evaluator
      </EvaluatorDetailsAction>
    </Flex>
  );
}

function CodeCustomEvaluatorDetails({
  evaluator,
  onAttachCodeEvaluator,
  onDuplicateEvaluator,
}: {
  evaluator: CodeProjectEvaluatorDetails;
  onAttachCodeEvaluator: () => void;
  onDuplicateEvaluator: () => void;
}) {
  return (
    <Flex direction="column" gap="size-200" height="100%">
      <CustomEvaluatorDetailsHeader evaluator={evaluator} />
      <dl className="project-evaluator-gallery__definition-list">
        <div>
          <dt>
            <Text size="XS" color="text-500">
              Language
            </Text>
          </dt>
          <dd>
            <Text size="S">{capitalize(evaluator.language.toLowerCase())}</Text>
          </dd>
        </div>
      </dl>
      <EvaluatorOutputSummary outputConfigs={evaluator.outputConfigs} />
      <EvaluatorInputSummary inputs={evaluator.inputs} />
      <Flex direction="column" gap="size-75">
        <Text elementType="h3" size="S" weight="heavy">
          Code
        </Text>
        <div css={codePreviewWellCSS}>
          <ExpandableContent
            height={CODE_PREVIEW_COLLAPSED_HEIGHT}
            expandedBehavior="grow"
            overlayBackgroundColor="var(--global-background-color-100)"
          >
            {evaluator.language === "PYTHON" ? (
              <PythonBlockWithCopy value={evaluator.sourceCode} />
            ) : (
              <TypeScriptBlockWithCopy value={evaluator.sourceCode} />
            )}
          </ExpandableContent>
        </div>
      </Flex>
      <EvaluatorDetailsAction
        onPress={onAttachCodeEvaluator}
        secondaryAction={{
          label: "Duplicate this evaluator",
          onPress: onDuplicateEvaluator,
        }}
      >
        Use this evaluator
      </EvaluatorDetailsAction>
    </Flex>
  );
}

function EvaluatorPromptPreview({
  messages,
}: {
  messages: PlaygroundChatTemplate["messages"];
}) {
  if (messages.length === 0) return null;
  return (
    <Flex direction="column" gap="size-75">
      <Text elementType="h3" size="S" weight="heavy">
        Prompt
      </Text>
      <div css={detailsSectionWellCSS}>
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
  );
}

function EvaluatorDetailsAction({
  children,
  onPress,
  secondaryAction,
}: {
  children: string;
  onPress: () => void;
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
}) {
  return (
    <Flex direction="column" gap="size-100" css={stickyUseTemplateFooterCSS}>
      <Button variant="primary" onPress={onPress}>
        {children}
      </Button>
      {secondaryAction ? (
        <Button onPress={secondaryAction.onPress}>
          {secondaryAction.label}
        </Button>
      ) : null}
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
      <EvaluatorInputSummary
        inputs={(template.inputs ?? []).map((input) => ({
          name: input.name,
          description: input.description,
        }))}
      />
      <AnnotationValues
        values={choices}
        optimizationDirection={template.optimizationDirection}
      />
      <EvaluatorPromptPreview messages={messages} />
      <EvaluatorDetailsAction onPress={onUseTemplate}>
        Customize this evaluator
      </EvaluatorDetailsAction>
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
const CODE_PREVIEW_COLLAPSED_HEIGHT = 240;

const detailsSectionWellCSS = css`
  background-color: var(--global-background-color-100);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-size-150);
`;

const listSectionWellCSS = css`
  padding: var(--global-dimension-size-50);
`;

const inputNameCSS = css`
  overflow-wrap: anywhere;
`;

const promptPreviewMessageCSS = css`
  white-space: pre-wrap;
`;

const codePreviewWellCSS = css`
  overflow: hidden;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

const emptyDescriptionCSS = css`
  font-style: italic;
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

function EvaluatorDetailsSkeleton() {
  return <Skeleton width="100%" height={360} animation="wave" />;
}

function EvaluatorDetailsError() {
  return (
    <Text size="S" color="text-500">
      Evaluator details could not be loaded.
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
    scroll-behavior: smooth;

    @media (prefers-reduced-motion: reduce) {
      scroll-behavior: auto;
    }
  }

  .project-evaluator-gallery__template-category-section {
    display: grid;
    grid-template-columns: repeat(
      auto-fit,
      minmax(var(--project-evaluator-gallery-template-card-min-width), 1fr)
    );
    align-content: start;
    gap: var(--global-dimension-size-100);
  }

  .project-evaluator-gallery__template-category-header {
    grid-column: 1 / -1;
  }

  .project-evaluator-gallery__template-category-heading {
    /* Anchor target for the category nav; offset so scrollIntoView doesn't
       tuck it flush against the scroll region's top edge. */
    scroll-margin-top: var(--global-dimension-size-100);
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
