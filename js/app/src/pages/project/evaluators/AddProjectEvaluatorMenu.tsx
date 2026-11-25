import { Suspense, useState } from "react";
import type { MenuTriggerProps } from "react-aria-components";
import {
  Autocomplete,
  Input,
  MenuSection,
  SubmenuTrigger,
} from "react-aria-components";
import { useLazyLoadQuery } from "react-relay";
import { useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import { Alert } from "@phoenix/components/core/alert";
import type { ButtonProps } from "@phoenix/components/core/button";
import { Button } from "@phoenix/components/core/button";
import { Text } from "@phoenix/components/core/content";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { SearchField, SearchIcon } from "@phoenix/components/core/field";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { Flex } from "@phoenix/components/core/layout";
import { Loading } from "@phoenix/components/core/loading";
import {
  Menu,
  MenuContainer,
  MenuHeader,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
} from "@phoenix/components/core/menu";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { View } from "@phoenix/components/core/view";
import { ErrorBoundary } from "@phoenix/components/exception";
import { useDebouncedChange } from "@phoenix/hooks/useDebouncedChange";
import type {
  EvaluatorKind,
  projectEvaluatorOptionsQuery,
} from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorOptionsQuery.graphql";
import { formatEvaluatorUsage } from "@phoenix/pages/project/evaluators/projectEvaluatorFormat";
import { projectEvaluatorOptionsQuery as projectEvaluatorOptionsQueryNode } from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";
import {
  useProjectEvaluatorCreationPaths,
  useProjectEvaluatorPaths,
} from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";

export const AddProjectEvaluatorMenu = ({
  size,
  buttonClassName,
  buttonLabel = "Add evaluator",
  shouldShowGalleryLink = true,
  ...props
}: ProjectEvaluatorMenuTriggerProps) => {
  return (
    <MenuTrigger {...props}>
      <Button
        className={buttonClassName}
        variant="primary"
        size={size}
        leadingVisual={<Icon svg={<Icons.Plus />} />}
      >
        {buttonLabel}
      </Button>
      <MenuContainer minHeight="auto">
        <ProjectEvaluatorMenuItems
          menuLabel={buttonLabel}
          shouldShowGalleryLink={shouldShowGalleryLink}
        />
      </MenuContainer>
    </MenuTrigger>
  );
};

/**
 * The empty state's menu. Building from scratch means starting a new
 * evaluator, so it offers one blank evaluator per kind and nothing that
 * starts from an existing evaluator.
 */
export const BuildProjectEvaluatorMenu = ({
  size,
  ...props
}: Pick<ProjectEvaluatorMenuTriggerProps, "size"> &
  Omit<MenuTriggerProps, "children">) => {
  const navigate = useNavigate();
  const creationPaths = useProjectEvaluatorCreationPaths();
  return (
    <MenuTrigger {...props}>
      <Button variant="default" size={size}>
        Build from scratch
      </Button>
      <MenuContainer minHeight="auto">
        <Menu
          aria-label="Build from scratch"
          onAction={(action) => {
            if (action === "createEvaluator") {
              navigate(creationPaths.newLlm);
            } else if (action === "createCodeEvaluator") {
              navigate(creationPaths.newCode);
            } else if (action === "createDecisionEvaluator") {
              navigate(creationPaths.newDecision);
            }
          }}
        >
          <MenuItem
            id="createEvaluator"
            leadingContent={<Icon svg={<Icons.LLMOutput />} />}
          >
            New LLM evaluator
          </MenuItem>
          <MenuItem
            id="createCodeEvaluator"
            leadingContent={<Icon svg={<Icons.Code />} />}
          >
            New code evaluator
          </MenuItem>
          <MenuItem
            id="createDecisionEvaluator"
            leadingContent={<Icon svg={<Icons.Split />} />}
          >
            New decision evaluator
          </MenuItem>
        </Menu>
      </MenuContainer>
    </MenuTrigger>
  );
};

type ProjectEvaluatorMenuTriggerProps = {
  size: ButtonProps["size"];
  buttonClassName?: string;
  buttonLabel?: string;
  /** Hide the "Browse eval gallery" item, e.g. inside the gallery modal. */
  shouldShowGalleryLink?: boolean;
} & Omit<MenuTriggerProps, "children">;

function ProjectEvaluatorMenuItems({
  menuLabel,
  shouldShowGalleryLink,
}: {
  menuLabel: string;
  shouldShowGalleryLink: boolean;
}) {
  const navigate = useNavigate();
  // Anchored at the route rendering this menu, so the slideover opens over
  // the list or over the gallery, whichever the menu is in.
  const creationPaths = useProjectEvaluatorCreationPaths();
  const { gallery } = useProjectEvaluatorPaths();
  return (
    <Menu
      aria-label={menuLabel}
      onAction={(action) => {
        if (action === "createEvaluator") {
          navigate(creationPaths.newLlm);
        } else if (action === "createCodeEvaluator") {
          navigate(creationPaths.newCode);
        } else if (action === "createDecisionEvaluator") {
          navigate(creationPaths.newDecision);
        }
      }}
    >
      {shouldShowGalleryLink ? (
        <MenuSection>
          <MenuItem
            id="browseGallery"
            href={gallery()}
            leadingContent={<Icon svg={<Icons.Grid />} />}
          >
            Browse eval gallery
          </MenuItem>
        </MenuSection>
      ) : null}
      {/* Only code offers "Add existing": LLM and decision evaluators already
          share their logic through saved prompts and decisions. */}
      <MenuSection>
        <MenuSectionTitle title="LLM" />
        <MenuItem
          id="createEvaluator"
          leadingContent={<Icon svg={<Icons.Plus />} />}
        >
          New LLM evaluator
        </MenuItem>
        <EvaluatorSubmenu
          label="Copy existing LLM evaluator"
          icon={<Icons.Duplicate />}
          kind="LLM"
          onAction={(evaluatorId) =>
            navigate(creationPaths.copyLlm(evaluatorId))
          }
        />
      </MenuSection>
      <MenuSection>
        <MenuSectionTitle title="Code" />
        <MenuItem
          id="createCodeEvaluator"
          leadingContent={<Icon svg={<Icons.Plus />} />}
        >
          New code evaluator
        </MenuItem>
        <EvaluatorSubmenu
          label="Copy existing code evaluator"
          icon={<Icons.Duplicate />}
          kind="CODE"
          onAction={(evaluatorId) =>
            navigate(creationPaths.copyCode(evaluatorId))
          }
        />
        <EvaluatorSubmenu
          label="Add existing code evaluator"
          icon={<Icons.Link2 />}
          kind="CODE"
          isExcludingCurrentProject
          onAction={(evaluatorId) =>
            navigate(creationPaths.attach(evaluatorId))
          }
        />
      </MenuSection>
      <MenuSection>
        <MenuSectionTitle title="Decision" />
        <MenuItem
          id="createDecisionEvaluator"
          leadingContent={<Icon svg={<Icons.Plus />} />}
        >
          New decision evaluator
        </MenuItem>
        <EvaluatorSubmenu
          label="Copy existing decision evaluator"
          icon={<Icons.Duplicate />}
          kind="DECISION"
          onAction={(evaluatorId) =>
            navigate(creationPaths.copyDecision(evaluatorId))
          }
        />
      </MenuSection>
    </Menu>
  );
}

const SEARCH_DEBOUNCE_MS = 300;

type ExistingEvaluatorKind = Exclude<EvaluatorKind, "BUILTIN">;

const EVALUATOR_KIND_NOUNS: Record<ExistingEvaluatorKind, string> = {
  LLM: "LLM",
  CODE: "code",
  DECISION: "decision",
};

type EvaluatorSubmenuProps = {
  label: string;
  icon: React.ReactElement;
  kind: ExistingEvaluatorKind;
  /** Hides evaluators this project runs; adding one twice clashes on its name. */
  isExcludingCurrentProject?: boolean;
  onAction: (id: string) => void;
};

/**
 * Fetches its evaluators only when opened, and searches on the server so the
 * search reaches past the first page.
 */
function EvaluatorSubmenu(props: EvaluatorSubmenuProps) {
  const { label, icon, kind } = props;
  const [nameFilter, setNameFilter] = useState("");
  const setDebouncedNameFilter = useDebouncedChange({
    onChange: setNameFilter,
    debounceMs: SEARCH_DEBOUNCE_MS,
  });
  return (
    <SubmenuTrigger>
      <MenuItem leadingContent={<Icon svg={icon} />}>{label}</MenuItem>
      <MenuContainer
        shouldFlip
        placement="start top"
        maxWidth={350}
        minHeight="auto"
      >
        <Autocomplete
          onInputChange={(value) => setDebouncedNameFilter(value.trim())}
        >
          <MenuHeader>
            <SearchField
              aria-label={`Search ${label.toLowerCase()}`}
              autoFocus
              variant="quiet"
            >
              <SearchIcon />
              <Input
                placeholder={`Search ${EVALUATOR_KIND_NOUNS[kind]} evaluators`}
              />
            </SearchField>
          </MenuHeader>
          {/* A new search retries a failed load. */}
          <ErrorBoundary
            resetKey={nameFilter}
            fallback={() => (
              <View padding="size-100">
                <Alert variant="danger">Couldn't load the evaluators</Alert>
              </View>
            )}
          >
            <Suspense fallback={<Loading />}>
              <EvaluatorSubmenuList {...props} nameFilter={nameFilter} />
            </Suspense>
          </ErrorBoundary>
        </Autocomplete>
      </MenuContainer>
    </SubmenuTrigger>
  );
}

function EvaluatorSubmenuList({
  label,
  icon,
  kind,
  isExcludingCurrentProject = false,
  nameFilter,
  onAction,
}: EvaluatorSubmenuProps & { nameFilter: string }) {
  const { projectId } = useParams();
  invariant(projectId, "projectId is required");
  const data = useLazyLoadQuery<projectEvaluatorOptionsQuery>(
    projectEvaluatorOptionsQueryNode,
    {
      kinds: [kind],
      filter: nameFilter ? { col: "name", value: nameFilter } : null,
      excludeProjectId: isExcludingCurrentProject ? projectId : null,
    },
    { fetchPolicy: "store-and-network" }
  );
  const evaluators = data.evaluators.edges.map(({ evaluator }) => ({
    ...evaluator,
    usage: formatEvaluatorUsage({
      projects: evaluator.projects.edges.map(({ project }) => project),
      currentProjectId: projectId,
      numDatasets: evaluator.datasets.edges.length,
    }),
  }));
  return (
    <>
      <Menu
        aria-label={label}
        items={evaluators}
        onAction={(key) => onAction(String(key))}
        renderEmptyState={() => (
          <CompactEmptyState
            icon={<Icon svg={icon} />}
            description={
              isExcludingCurrentProject
                ? `No ${EVALUATOR_KIND_NOUNS[kind]} evaluators outside this project`
                : `No ${EVALUATOR_KIND_NOUNS[kind]} evaluators yet`
            }
          />
        )}
      >
        {(evaluator) => (
          <MenuItem id={evaluator.id} textValue={evaluator.name}>
            <Flex direction="column" gap="size-50">
              <Text weight="heavy">{evaluator.name}</Text>
              {evaluator.description ? (
                <Truncate maxLines={3} title={evaluator.description}>
                  <Text size="S" color="text-700">
                    {evaluator.description}
                  </Text>
                </Truncate>
              ) : (
                <Text size="S" color="text-500" fontStyle="italic">
                  No description
                </Text>
              )}
              <Text size="XS" color="text-500">
                {evaluator.usage}
              </Text>
            </Flex>
          </MenuItem>
        )}
      </Menu>
      {data.evaluators.pageInfo.hasNextPage ? (
        <View paddingX="size-150" paddingY="size-100">
          <Text size="XS" color="text-500">
            Search to find more evaluators
          </Text>
        </View>
      ) : null}
    </>
  );
}
