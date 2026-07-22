import { css } from "@emotion/react";
import { type ReactNode, useCallback, useRef, useState } from "react";
import type { Key } from "react-aria-components";

import {
  Button,
  Flex,
  Heading,
  Input,
  Slider,
  SliderNumberField,
  Text,
  View,
} from "@phoenix/components";
import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components/core/disclosure";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { ProjectEvaluatorTargetField } from "@phoenix/pages/project/evaluators/ProjectEvaluatorTargetField";
import type {
  ProjectEvaluatorScope,
  ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { SpanFilterConditionFieldCore } from "@phoenix/pages/project/SpanFilterConditionField";

export const ProjectEvaluatorFormSections = ({
  projectId,
  scope,
  onScopeChange,
  expandedKeys,
  onExpandedChange,
  definitionKind,
  codeEvaluatorName,
  codeDefinition,
  onFilterValidityChange,
}: {
  projectId: string;
  scope: ProjectEvaluatorScope;
  onScopeChange: (scope: ProjectEvaluatorScope) => void;
  expandedKeys: Set<Key>;
  onExpandedChange: (keys: Set<Key>) => void;
  definitionKind: "llm" | "code" | "newCode";
  codeEvaluatorName?: string;
  /** Authoring fields rendered in the definition section when `newCode`. */
  codeDefinition?: ReactNode;
  onFilterValidityChange?: (isValid: boolean) => void;
}) => {
  const setEvaluatorMappingSource = useEvaluatorStore(
    (state) => state.setEvaluatorMappingSource
  );
  // The editor's live text; only validated conditions are lifted into `scope`.
  const [filterConditionDraft, setFilterConditionDraft] = useState(
    scope.filterCondition
  );
  const updateTarget = (targetType: ProjectEvaluatorTarget) => {
    onScopeChange({ ...scope, targetType });
  };
  // The filter field re-invokes `onValidCondition` on every validation pass, so
  // it must keep a stable identity: an inline arrow would re-fire the field's
  // validation effect each render and lift a fresh `scope` object even when the
  // condition is unchanged, spinning an unbounded validate/re-render loop. Read
  // the latest scope/expandedKeys from refs and only lift when the validated
  // condition actually differs.
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const expandedKeysRef = useRef(expandedKeys);
  expandedKeysRef.current = expandedKeys;
  const handleValidCondition = useCallback(
    (filterCondition: string) => {
      const currentScope = scopeRef.current;
      if (filterCondition === currentScope.filterCondition) {
        return;
      }
      onScopeChange({ ...currentScope, filterCondition });
      if (
        filterCondition.trim() !== "" &&
        !expandedKeysRef.current.has("definition")
      ) {
        onExpandedChange(new Set([...expandedKeysRef.current, "definition"]));
      }
    },
    [onScopeChange, onExpandedChange]
  );
  return (
    <DisclosureGroup
      expandedKeys={expandedKeys}
      onExpandedChange={onExpandedChange}
    >
      <Disclosure id="scope">
        <DisclosureTrigger direction="column" alignItems="start">
          <Heading level={2}>Scope</Heading>
          <Text color="text-500">
            Choose which spans run this evaluator and how often.
          </Text>
        </DisclosureTrigger>
        <DisclosurePanel>
          <Flex direction="column" gap="size-200">
            <ProjectEvaluatorTargetField
              value={scope.targetType}
              onChange={updateTarget}
            />
            <Flex direction="column" gap="size-100">
              <Heading level={3}>Span filter</Heading>
              <Text color="text-500">
                Only spans matching this validated filter are evaluated.
              </Text>
              <SpanFilterConditionFieldCore
                projectId={projectId}
                filterCondition={filterConditionDraft}
                onFilterConditionChange={setFilterConditionDraft}
                onAppendFilterCondition={(condition) =>
                  setFilterConditionDraft((current) =>
                    current ? `${current} and ${condition}` : condition
                  )
                }
                onValidCondition={handleValidCondition}
                onValidityChange={onFilterValidityChange}
                placeholder="span_kind == 'LLM'"
              />
              {!filterConditionDraft.trim() ? (
                <Button
                  variant="quiet"
                  onPress={() =>
                    onExpandedChange(new Set([...expandedKeys, "definition"]))
                  }
                >
                  Create an unfiltered evaluator
                </Button>
              ) : null}
            </Flex>
            <Slider
              css={css`
                max-width: 340px;
              `}
              label="Sampling rate"
              minValue={0}
              maxValue={100}
              step={1}
              value={scope.samplingRatePercent}
              onChange={(samplingRatePercent) =>
                onScopeChange({ ...scope, samplingRatePercent })
              }
              thumbLabels={["Sampling rate percentage"]}
            >
              <SliderNumberField aria-label="Sampling rate percentage">
                <Input />
              </SliderNumberField>
              <Text>%</Text>
            </Slider>
          </Flex>
        </DisclosurePanel>
      </Disclosure>
      <Disclosure id="definition" defaultExpanded={false}>
        <DisclosureTrigger direction="column" alignItems="start">
          <Heading level={2}>Evaluator definition</Heading>
          <Text color="text-500">
            {definitionKind === "llm"
              ? "Define the prompt and annotation output."
              : definitionKind === "newCode"
                ? "Author the evaluator's source code and annotation output."
                : "Attach the selected code evaluator to this project."}
          </Text>
        </DisclosureTrigger>
        <DisclosurePanel>
          {definitionKind === "llm" ? (
            <Flex direction="column" gap="size-200">
              <EvaluatorNameAndDescriptionFields />
              <LLMEvaluatorForm showInputMapping={false} />
            </Flex>
          ) : definitionKind === "newCode" ? (
            codeDefinition
          ) : (
            <View padding="size-200">
              <Heading level={3}>{codeEvaluatorName}</Heading>
            </View>
          )}
        </DisclosurePanel>
      </Disclosure>
      <Disclosure id="advanced" defaultExpanded={false}>
        <DisclosureTrigger direction="column" alignItems="start">
          <Heading level={2}>Advanced mapping</Heading>
          <Text color="text-500">
            Same-named input, output, and metadata variables bind automatically.
          </Text>
        </DisclosureTrigger>
        <DisclosurePanel>
          <Flex direction="column" gap="size-100">
            <Text color="text-500">
              Add only overrides that differ from the top-level span context.
            </Text>
            <View
              borderRadius="medium"
              borderWidth="thin"
              borderColor="default"
              padding="size-200"
            >
              <EvaluatorInputMapping />
            </View>
            <Button
              variant="quiet"
              onPress={() =>
                setEvaluatorMappingSource({
                  input: {},
                  output: {},
                  metadata: { attributes: {} },
                })
              }
            >
              Clear selected span context
            </Button>
          </Flex>
        </DisclosurePanel>
      </Disclosure>
    </DisclosureGroup>
  );
};
