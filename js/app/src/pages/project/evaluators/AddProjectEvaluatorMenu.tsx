import { Suspense } from "react";
import type {
  MenuTriggerProps,
  SubmenuTriggerProps,
} from "react-aria-components";
import { MenuSection, SubmenuTrigger } from "react-aria-components";
import { useLazyLoadQuery } from "react-relay";
import { useNavigate } from "react-router";

import type { ButtonProps } from "@phoenix/components/core/button";
import { Button } from "@phoenix/components/core/button";
import { Text } from "@phoenix/components/core/content";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { Flex } from "@phoenix/components/core/layout";
import { Loading } from "@phoenix/components/core/loading";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
} from "@phoenix/components/core/menu";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { View } from "@phoenix/components/core/view";
import type { projectEvaluatorOptionsQuery } from "@phoenix/pages/project/evaluators/__generated__/projectEvaluatorOptionsQuery.graphql";
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
      {/* Keep the query inside the popover so the evaluator list is fetched
          only when the menu opens. */}
      <MenuContainer minHeight="auto">
        <Suspense fallback={<Loading />}>
          <ProjectEvaluatorMenuItems
            menuLabel={buttonLabel}
            shouldShowGalleryLink={shouldShowGalleryLink}
          />
        </Suspense>
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
            aria-label="Create new LLM evaluator"
            leadingContent={<Icon svg={<Icons.LLMOutput />} />}
          >
            LLM evaluator
          </MenuItem>
          <MenuItem
            id="createCodeEvaluator"
            aria-label="Create new code evaluator"
            leadingContent={<Icon svg={<Icons.Code />} />}
          >
            Code evaluator
          </MenuItem>
          <MenuItem
            id="createDecisionEvaluator"
            aria-label="Create new decision evaluator"
            leadingContent={<Icon svg={<Icons.Split />} />}
          >
            Decision evaluator
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
  const data = useLazyLoadQuery<projectEvaluatorOptionsQuery>(
    projectEvaluatorOptionsQueryNode,
    {},
    { fetchPolicy: "store-and-network" }
  );
  const evaluators = data.evaluators.edges.map(({ evaluator }) => evaluator);
  const llmEvaluators = evaluators.filter(
    (evaluator) => evaluator.__typename === "LLMEvaluator"
  );
  const codeEvaluators = evaluators.filter(
    (evaluator) => evaluator.__typename === "CodeEvaluator"
  );
  const decisionEvaluators = evaluators.filter(
    (evaluator) => evaluator.__typename === "DecisionEvaluator"
  );
  const hasMoreEvaluators = data.evaluators.pageInfo.hasNextPage;
  return (
    <>
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
        {/* Each section names the kind, so its items name only the action.
            "Use as is" attaches the existing evaluator itself, so edits to it
            apply everywhere it runs. "Copy and edit" creates a new evaluator
            from a copy, which can change without affecting the original. */}
        <MenuSection>
          <MenuSectionTitle title="LLM" />
          <MenuItem
            id="createEvaluator"
            aria-label="Create new LLM evaluator"
            leadingContent={<Icon svg={<Icons.Plus />} />}
          >
            New
          </MenuItem>
          <EvaluatorSubmenu
            label="Copy and edit"
            kindLabel="LLM"
            icon={<Icons.Duplicate />}
            evaluators={llmEvaluators}
            onAction={(evaluatorId) =>
              navigate(creationPaths.copyLlm(evaluatorId))
            }
          />
        </MenuSection>
        <MenuSection>
          <MenuSectionTitle title="Code" />
          <MenuItem
            id="createCodeEvaluator"
            aria-label="Create new code evaluator"
            leadingContent={<Icon svg={<Icons.Plus />} />}
          >
            New
          </MenuItem>
          <EvaluatorSubmenu
            label="Use as is"
            kindLabel="code"
            icon={<Icons.Code />}
            evaluators={codeEvaluators}
            onAction={(evaluatorId) =>
              navigate(creationPaths.attach(evaluatorId))
            }
          />
          <EvaluatorSubmenu
            label="Copy and edit"
            kindLabel="code"
            icon={<Icons.Duplicate />}
            evaluators={codeEvaluators}
            onAction={(evaluatorId) =>
              navigate(creationPaths.copyCode(evaluatorId))
            }
          />
        </MenuSection>
        <MenuSection>
          <MenuSectionTitle title="Decision" />
          <MenuItem
            id="createDecisionEvaluator"
            aria-label="Create new decision evaluator"
            leadingContent={<Icon svg={<Icons.Plus />} />}
          >
            New
          </MenuItem>
          <EvaluatorSubmenu
            label="Use as is"
            kindLabel="decision"
            icon={<Icons.Split />}
            evaluators={decisionEvaluators}
            onAction={(evaluatorId) =>
              navigate(creationPaths.attach(evaluatorId))
            }
          />
        </MenuSection>
      </Menu>
      {hasMoreEvaluators ? (
        <View paddingX="size-200" paddingY="size-100">
          <Text size="S" color="text-500">
            Showing the 100 most recently updated evaluators.
          </Text>
        </View>
      ) : null}
    </>
  );
}

/**
 * A submenu of existing evaluators of one kind. It is left out when there are
 * none, rather than shown disabled.
 */
function EvaluatorSubmenu({
  label,
  kindLabel,
  icon,
  evaluators,
  onAction,
}: {
  label: string;
  /** Completes the accessible name, which the visible label leaves to the section title. */
  kindLabel: string;
  icon: React.ReactElement;
  evaluators: ReadonlyArray<{
    id: string;
    name: string;
    description: string | null;
  }>;
  onAction: (id: string) => void;
} & Omit<SubmenuTriggerProps, "children">) {
  if (evaluators.length === 0) {
    return null;
  }
  return (
    <SubmenuTrigger>
      <MenuItem
        aria-label={`${label}: existing ${kindLabel} evaluator`}
        leadingContent={<Icon svg={icon} />}
      >
        {label}
      </MenuItem>
      <MenuContainer
        shouldFlip
        placement="start top"
        maxWidth={350}
        minHeight="auto"
      >
        <Menu items={evaluators} onAction={(key) => onAction(String(key))}>
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
              </Flex>
            </MenuItem>
          )}
        </Menu>
      </MenuContainer>
    </SubmenuTrigger>
  );
}
