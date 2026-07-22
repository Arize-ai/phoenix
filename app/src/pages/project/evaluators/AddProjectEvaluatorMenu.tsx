import { Suspense, useMemo, useState } from "react";
import type {
  MenuTriggerProps,
  SubmenuTriggerProps,
} from "react-aria-components";
import { MenuSection, SubmenuTrigger } from "react-aria-components";
import { graphql, useLazyLoadQuery } from "react-relay";

import type { ButtonProps } from "@phoenix/components/core/button";
import { Button } from "@phoenix/components/core/button";
import { Text } from "@phoenix/components/core/content";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { Flex } from "@phoenix/components/core/layout";
import { Loading } from "@phoenix/components/core/loading";
import { View } from "@phoenix/components/core/view";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuSectionTitle,
  MenuTrigger,
} from "@phoenix/components/core/menu";
import { extractCodeEvaluatorVariables } from "@phoenix/components/evaluators/codeEvaluatorUtils";
import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import type { AddProjectEvaluatorMenuQuery } from "@phoenix/pages/project/evaluators/__generated__/AddProjectEvaluatorMenuQuery.graphql";
import {
  CreateLLMProjectEvaluatorSlideover,
  type ProjectEvaluatorCreationMode,
} from "@phoenix/pages/project/evaluators/CreateLLMProjectEvaluatorSlideover";
import { dropReferencePathMappings } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { generateMessageId } from "@phoenix/store";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type {
  CodeEvaluatorLanguage,
  EvaluatorInputMapping,
} from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { convertPromptVersionMessagesToPlaygroundInstanceMessages } from "@phoenix/utils/promptUtils";

export const AddProjectEvaluatorMenu = ({
  size,
  projectId,
  updateConnectionIds = [],
  ...props
}: {
  size: ButtonProps["size"];
  projectId: string;
  updateConnectionIds?: string[];
} & Omit<MenuTriggerProps, "children">) => {
  const [creationMode, setCreationMode] =
    useState<ProjectEvaluatorCreationMode | null>(null);
  return (
    <>
      <MenuTrigger {...props}>
        <Button
          variant="primary"
          size={size}
          leadingVisual={<Icon svg={<Icons.Plus />} />}
        >
          Add evaluator
        </Button>
        {/* The query lives inside the popover so the evaluator list is only
            fetched when the menu opens, not on every table render. */}
        <MenuContainer minHeight="auto">
          <Suspense fallback={<Loading />}>
            <AddProjectEvaluatorMenuItems
              onSelectCreationMode={setCreationMode}
            />
          </Suspense>
        </MenuContainer>
      </MenuTrigger>
      {creationMode ? (
        <CreateLLMProjectEvaluatorSlideover
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) setCreationMode(null);
          }}
          projectId={projectId}
          creationMode={creationMode}
          updateConnectionIds={updateConnectionIds}
        />
      ) : null}
    </>
  );
};

function AddProjectEvaluatorMenuItems({
  onSelectCreationMode,
}: {
  onSelectCreationMode: (mode: ProjectEvaluatorCreationMode) => void;
}) {
  const data = useLazyLoadQuery<AddProjectEvaluatorMenuQuery>(
    graphql`
      query AddProjectEvaluatorMenuQuery {
        evaluators(first: 100, sort: { col: updatedAt, dir: desc }) {
          edges {
            evaluator: node {
              __typename
              id
              name
              description
              kind
              ... on LLMEvaluator {
                outputConfigs {
                  __typename
                  ... on CategoricalAnnotationConfig {
                    name
                    optimizationDirection
                    values {
                      label
                      score
                    }
                  }
                  ... on ContinuousAnnotationConfig {
                    name
                    optimizationDirection
                    lowerBound
                    upperBound
                  }
                  ... on FreeformAnnotationConfig {
                    name
                    optimizationDirection
                    threshold
                    lowerBound
                    upperBound
                  }
                }
                promptVersion {
                  templateFormat
                  template {
                    __typename
                    ... on PromptChatTemplate {
                      messages {
                        ...promptUtils_promptMessages
                      }
                    }
                    ... on PromptStringTemplate {
                      template
                    }
                  }
                  tools {
                    tools {
                      __typename
                      ... on PromptToolFunction {
                        function {
                          parameters
                        }
                      }
                      ... on PromptToolRaw {
                        raw
                      }
                    }
                  }
                }
              }
              ... on CodeEvaluator {
                sourceCode
                language
                inputMapping {
                  pathMapping
                  literalMapping
                }
                outputConfigs {
                  __typename
                  ... on CategoricalAnnotationConfig {
                    name
                    optimizationDirection
                    values {
                      label
                      score
                    }
                  }
                  ... on ContinuousAnnotationConfig {
                    name
                    optimizationDirection
                    lowerBound
                    upperBound
                  }
                  ... on FreeformAnnotationConfig {
                    name
                    optimizationDirection
                    threshold
                    lowerBound
                    upperBound
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `,
    {},
    { fetchPolicy: "store-and-network" }
  );
  const evaluators = useMemo(
    () => data.evaluators.edges.map(({ evaluator }) => evaluator),
    [data.evaluators.edges]
  );
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
        aria-label="Add evaluator"
        onAction={(action) => {
          if (action === "createEvaluator") {
            onSelectCreationMode({ kind: "scratch" });
          }
        }}
      >
        <MenuSection>
          <MenuSectionTitle title="LLM evaluator" />
          <MenuItem
            leadingContent={<Icon svg={<Icons.Plus />} />}
            id="createEvaluator"
          >
            Create from scratch
          </MenuItem>
          <EvaluatorSubmenu
            label="Copy existing LLM evaluator"
            icon={<Icons.LLMOutput />}
            evaluators={llmEvaluators}
            onAction={(evaluatorId) => {
              const evaluator = llmEvaluators.find(
                ({ id }) => id === evaluatorId
              );
              if (!evaluator) return;
              const template = evaluator.promptVersion?.template;
              if (!template) return;
              const defaultMessages =
                template.__typename === "PromptChatTemplate"
                  ? convertPromptVersionMessagesToPlaygroundInstanceMessages({
                      promptMessagesRefs: template.messages,
                    })
                  : template.__typename === "PromptStringTemplate"
                    ? [
                        {
                          id: generateMessageId(),
                          role: "user" as const,
                          content: template.template,
                        },
                      ]
                    : null;
              if (!defaultMessages) return;
              onSelectCreationMode({
                kind: "copy",
                initialState: {
                  name: evaluator.name,
                  description: evaluator.description ?? "",
                  outputConfigs: convertOutputConfigs(
                    evaluator.outputConfigs ?? []
                  ),
                  defaultMessages,
                  templateFormat:
                    evaluator.promptVersion?.templateFormat ?? "MUSTACHE",
                  includeExplanation: inferIncludeExplanationFromPrompt(
                    evaluator.promptVersion?.tools
                  ),
                },
              });
            }}
          />
        </MenuSection>
        <MenuSection>
          <MenuSectionTitle title="Code evaluator" />
          <EvaluatorSubmenu
            label="Attach existing code evaluator"
            icon={<Icons.Code />}
            evaluators={codeEvaluators}
            onAction={(evaluatorId) => {
              const evaluator = codeEvaluators.find(
                ({ id }) => id === evaluatorId
              );
              if (!evaluator) return;
              const variables = extractCodeEvaluatorVariables({
                language: evaluator.language as CodeEvaluatorLanguage,
                sourceCode: evaluator.sourceCode ?? "",
              });
              onSelectCreationMode({
                kind: "code",
                evaluatorId: evaluator.id,
                name: evaluator.name,
                description: evaluator.description ?? "",
                inputMapping: dropReferencePathMappings(
                  convertInputMapping(
                    evaluator.inputMapping ?? {
                      pathMapping: {},
                      literalMapping: {},
                    }
                  )
                ),
                outputConfigs: convertOutputConfigs(
                  evaluator.outputConfigs ?? []
                ),
                variables,
              });
            }}
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
                  <Text size="S" color="text-700">
                    {evaluator.description}
                  </Text>
                ) : null}
              </Flex>
            </MenuItem>
          )}
        </Menu>
      </MenuContainer>
    </SubmenuTrigger>
  );
}

function convertOutputConfigs(
  configs: ReadonlyArray<unknown>
): AnnotationConfig[] {
  const outputConfigs: AnnotationConfig[] = [];
  for (const unknownConfig of configs) {
    if (!isStringKeyedObject(unknownConfig)) continue;
    const config = unknownConfig;
    const name = typeof config.name === "string" ? config.name : null;
    const optimizationDirection = getOptimizationDirection(
      config.optimizationDirection
    );
    if (!name || !optimizationDirection) continue;
    if (
      config.__typename === "CategoricalAnnotationConfig" &&
      Array.isArray(config.values)
    ) {
      outputConfigs.push({
        name,
        optimizationDirection,
        values: config.values.flatMap((unknownValue) => {
          if (
            !isStringKeyedObject(unknownValue) ||
            typeof unknownValue.label !== "string"
          ) {
            return [];
          }
          return [
            {
              label: unknownValue.label,
              score:
                typeof unknownValue.score === "number"
                  ? unknownValue.score
                  : undefined,
            },
          ];
        }),
      });
      continue;
    }
    if (config.__typename === "ContinuousAnnotationConfig") {
      outputConfigs.push({
        name,
        optimizationDirection,
        lowerBound: getNullableNumber(config.lowerBound),
        upperBound: getNullableNumber(config.upperBound),
      });
      continue;
    }
    if (config.__typename === "FreeformAnnotationConfig") {
      outputConfigs.push({
        name,
        optimizationDirection,
        threshold: getNullableNumber(config.threshold),
        lowerBound: getNullableNumber(config.lowerBound),
        upperBound: getNullableNumber(config.upperBound),
      });
    }
  }
  return outputConfigs;
}

function getOptimizationDirection(
  value: unknown
): "MAXIMIZE" | "MINIMIZE" | "NONE" | null {
  return value === "MAXIMIZE" || value === "MINIMIZE" || value === "NONE"
    ? value
    : null;
}

function getNullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function convertInputMapping(inputMapping: {
  pathMapping: unknown;
  literalMapping: unknown;
}): EvaluatorInputMapping {
  const pathMapping = isStringKeyedObject(inputMapping.pathMapping)
    ? Object.fromEntries(
        Object.entries(inputMapping.pathMapping).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    : {};
  const literalMapping = isStringKeyedObject(inputMapping.literalMapping)
    ? Object.fromEntries(
        Object.entries(inputMapping.literalMapping).filter(
          (entry): entry is [string, boolean | string | number] =>
            ["boolean", "string", "number"].includes(typeof entry[1])
        )
      )
    : {};
  return { pathMapping, literalMapping };
}
