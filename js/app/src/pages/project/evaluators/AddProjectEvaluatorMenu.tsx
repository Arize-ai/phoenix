import { Suspense } from "react";
import type {
  MenuTriggerProps,
  SubmenuTriggerProps,
} from "react-aria-components";
import { MenuSection, SubmenuTrigger } from "react-aria-components";
import { useLazyLoadQuery } from "react-relay";
import { useHref, useNavigate } from "react-router";

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
  type ProjectEvaluatorCreationPaths,
  useProjectEvaluatorPaths,
} from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";

export const AddProjectEvaluatorMenu = ({
  size,
  buttonClassName,
  buttonLabel = "Add evaluator",
  shouldShowGalleryLink = true,
  creationPaths,
  ...props
}: ProjectEvaluatorMenuTriggerProps) => {
  return (
    <ProjectEvaluatorMenu
      size={size}
      buttonClassName={buttonClassName}
      buttonLabel={buttonLabel}
      buttonVariant="primary"
      buttonLeadingVisual={<Icon svg={<Icons.Plus />} />}
      shouldShowGalleryLink={shouldShowGalleryLink}
      creationPaths={creationPaths}
      {...props}
    />
  );
};

export const BuildProjectEvaluatorMenu = ({
  size,
  ...props
}: ProjectEvaluatorMenuTriggerProps) => {
  return (
    <ProjectEvaluatorMenu
      size={size}
      buttonLabel="Build from scratch"
      buttonVariant="default"
      shouldShowGalleryLink={false}
      {...props}
    />
  );
};

type ProjectEvaluatorMenuTriggerProps = {
  size: ButtonProps["size"];
  buttonClassName?: string;
  buttonLabel?: string;
  /** Hide the "Browse eval gallery" item, e.g. when already on the gallery page. */
  shouldShowGalleryLink?: boolean;
  /** The routes to use for every evaluator-creation action in this menu. */
  creationPaths: ProjectEvaluatorCreationPaths;
} & Omit<MenuTriggerProps, "children">;

function ProjectEvaluatorMenu({
  size,
  buttonClassName,
  buttonLabel,
  buttonVariant,
  buttonLeadingVisual,
  shouldShowGalleryLink,
  creationPaths,
  ...props
}: ProjectEvaluatorMenuTriggerProps & {
  buttonLabel: string;
  buttonVariant: ButtonProps["variant"];
  buttonLeadingVisual?: ButtonProps["leadingVisual"];
  shouldShowGalleryLink: boolean;
}) {
  return (
    <MenuTrigger {...props}>
      <Button
        className={buttonClassName}
        variant={buttonVariant}
        size={size}
        leadingVisual={buttonLeadingVisual}
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
            creationPaths={creationPaths}
          />
        </Suspense>
      </MenuContainer>
    </MenuTrigger>
  );
}

function ProjectEvaluatorMenuItems({
  menuLabel,
  shouldShowGalleryLink,
  creationPaths,
}: {
  menuLabel: string;
  shouldShowGalleryLink: boolean;
  creationPaths: ProjectEvaluatorCreationPaths;
}) {
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  const galleryHref = useHref(paths.gallery);
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
          }
        }}
      >
        {shouldShowGalleryLink ? (
          <MenuSection>
            <MenuItem
              leadingContent={<Icon svg={<Icons.Grid />} />}
              id="browseGallery"
              href={galleryHref}
            >
              Browse eval gallery
            </MenuItem>
          </MenuSection>
        ) : null}
        <MenuSection>
          <MenuSectionTitle title="LLM evaluator" />
          <MenuItem
            leadingContent={<Icon svg={<Icons.Plus />} />}
            id="createEvaluator"
          >
            Create new LLM evaluator
          </MenuItem>
          <EvaluatorSubmenu
            label="Duplicate existing LLM evaluator"
            icon={<Icons.LLMOutput />}
            evaluators={llmEvaluators}
            onAction={(evaluatorId) =>
              navigate(creationPaths.copyLlm(evaluatorId))
            }
          />
        </MenuSection>
        <MenuSection>
          <MenuSectionTitle title="Code evaluator" />
          <MenuItem
            leadingContent={<Icon svg={<Icons.Plus />} />}
            id="createCodeEvaluator"
          >
            Create new code evaluator
          </MenuItem>
          <EvaluatorSubmenu
            label="Use existing code evaluator"
            icon={<Icons.Code />}
            evaluators={codeEvaluators}
            onAction={(evaluatorId) =>
              navigate(creationPaths.attachCode(evaluatorId))
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

function EvaluatorSubmenu({
  label,
  icon,
  evaluators,
  onAction,
}: {
  label: string;
  icon: React.ReactElement;
  evaluators: ReadonlyArray<{
    id: string;
    name: string;
    description: string | null;
  }>;
  onAction: (id: string) => void;
} & Omit<SubmenuTriggerProps, "children">) {
  const hasEvaluators = evaluators.length > 0;
  return (
    <SubmenuTrigger>
      <MenuItem
        leadingContent={<Icon svg={icon} />}
        isDisabled={!hasEvaluators}
      >
        {hasEvaluators ? label : `${label} (none available)`}
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
