import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components/core/disclosure";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorNameAndDescriptionFields } from "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields";
import { LLMEvaluatorForm } from "@phoenix/components/evaluators/LLMEvaluatorForm";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

/**
 * The left-panel definition flow for a project evaluator: what the judge
 * reads and does — name/description, the prompt (or code) definition, and a
 * collapsed-by-default advanced-mapping disclosure that summarizes its state
 * while closed. Scope and the annotation template live in the right-panel
 * {@link ProjectEvaluatorScopePanel}.
 */
export const ProjectEvaluatorFormSections = ({
  definitionKind,
  codeEvaluatorName,
  codeDefinition,
}: {
  definitionKind: "llm" | "code" | "newCode";
  codeEvaluatorName?: string;
  /** Authoring fields rendered in the definition section when `newCode`. */
  codeDefinition?: ReactNode;
}) => {
  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="column" gap="size-200" flex="none">
        <Flex direction="column" gap="size-25">
          <Heading level={2}>Evaluator</Heading>
          <Text color="text-500" size="S">
            {definitionKind === "llm"
              ? "The judge that runs on each matched span."
              : definitionKind === "newCode"
                ? "Author the evaluator's source code and annotation output."
                : "Attach the selected code evaluator to this project."}
          </Text>
        </Flex>
        {definitionKind === "llm" ? (
          <Flex direction="column" gap="size-200">
            <EvaluatorNameAndDescriptionFields />
            <LLMEvaluatorForm
              showInputMapping={false}
              showAnnotationConfig={false}
            />
          </Flex>
        ) : definitionKind === "newCode" ? (
          codeDefinition
        ) : (
          <View
            borderRadius="medium"
            borderWidth="thin"
            borderColor="default"
            padding="size-200"
          >
            <Heading level={3}>{codeEvaluatorName}</Heading>
          </View>
        )}
      </Flex>
      <AdvancedMappingDisclosure />
    </Flex>
  );
};

const AdvancedMappingDisclosure = () => {
  const pathMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping.pathMapping
  );
  const overrideCount = Object.keys(pathMapping).length;
  return (
    <Disclosure
      id="advanced"
      defaultExpanded={false}
      css={advancedMappingDisclosureCSS}
    >
      <DisclosureTrigger direction="column" alignItems="start" width="100%">
        <Heading level={2}>Advanced mapping</Heading>
        <Text color="text-500">
          {`input, output, and metadata bind automatically · ${
            overrideCount === 0
              ? "no overrides"
              : `${overrideCount} override${overrideCount === 1 ? "" : "s"}`
          }`}
        </Text>
      </DisclosureTrigger>
      <DisclosurePanel>
        <Flex direction="column" gap="size-100">
          <Text color="text-500">
            Add only overrides that differ from the top-level span context.
          </Text>
          <EvaluatorInputMapping />
        </Flex>
      </DisclosurePanel>
    </Disclosure>
  );
};

/**
 * Renders the standalone disclosure as a bordered card matching the sections
 * above it: the full card header is the click target (a standalone disclosure
 * trigger otherwise shrinks to fit its text), hover feedback spans the whole
 * width, and the mapping editor becomes the card body instead of a nested
 * bordered box.
 */
const advancedMappingDisclosureCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  .react-aria-Heading {
    width: 100%;
  }
  [slot="trigger"] {
    width: 100%;
    padding: var(--global-dimension-size-200);
    border-bottom: none;
    /* Keep the hover background inside the card's rounded corners without
       overflow: hidden, which would clip the editor's focus rings. */
    border-radius: calc(var(--global-rounding-medium) - 1px);
  }
  &[data-expanded="true"] [slot="trigger"] {
    border-bottom: 1px solid var(--global-border-color-default);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  .disclosure__panel > * {
    padding: var(--global-dimension-size-200);
  }
`;
