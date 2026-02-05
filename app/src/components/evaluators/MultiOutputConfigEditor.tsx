import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { css } from "@emotion/react";

import {
  Button,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";

import { OutputConfigItem } from "./OutputConfigItem";

export type MultiOutputConfigEditorProps = {
  /**
   * If true, only allows editing optimization direction.
   * Name and values/bounds will be read-only.
   */
  isReadOnly?: boolean;
  /**
   * If true, the add/remove buttons will be hidden.
   * Useful for built-in evaluators where configs are predefined.
   */
  hideAddRemove?: boolean;
  /**
   * Title for the section. Defaults to "Evaluator Annotations"
   */
  title?: string;
  /**
   * Description for the section.
   */
  description?: string;
};

/**
 * A component for editing multiple output configurations in an accordion layout.
 * Supports adding/removing configs and validates for unique names.
 */
export const MultiOutputConfigEditor = ({
  isReadOnly,
  hideAddRemove,
  title = "Evaluator Annotations",
  description = "The annotations that this evaluator will create.",
}: MultiOutputConfigEditorProps) => {
  const { outputConfigs, addOutputConfig, removeOutputConfig } =
    useEvaluatorStore(
      useShallow((state) => ({
        outputConfigs: state.outputConfigs,
        addOutputConfig: state.addOutputConfig,
        removeOutputConfig: state.removeOutputConfig,
      }))
    );

  // Check for duplicate names
  const duplicateNames = useMemo(() => {
    const names = outputConfigs.map((config) => config.name);
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const name of names) {
      if (name && seen.has(name)) {
        duplicates.add(name);
      }
      seen.add(name);
    }
    return duplicates;
  }, [outputConfigs]);

  const handleAddConfig = () => {
    // Create a new config with a unique default name
    const existingNames = new Set(outputConfigs.map((c) => c.name));
    let newName = "new_annotation";
    let counter = 1;
    while (existingNames.has(newName)) {
      newName = `new_annotation_${counter}`;
      counter++;
    }

    // Default to a categorical config
    const newConfig: AnnotationConfig = {
      name: newName,
      optimizationDirection: "MAXIMIZE",
      values: [
        { label: "Good", score: 1 },
        { label: "Bad", score: 0 },
      ],
    };
    addOutputConfig(newConfig);
  };

  const handleRemoveConfig = (index: number) => {
    if (outputConfigs.length > 1) {
      removeOutputConfig(index);
    }
  };

  if (outputConfigs.length === 0) {
    return (
      <View marginBottom="size-200" flex="none">
        <Flex direction="column" gap="size-100">
          <Heading level={2} weight="heavy">
            {title}
          </Heading>
          <Text color="text-500">{description}</Text>
          {!hideAddRemove && (
            <Button
              variant="default"
              size="S"
              onPress={handleAddConfig}
              leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
            >
              Add Output Config
            </Button>
          )}
        </Flex>
      </View>
    );
  }

  // Single config - render without accordion
  if (outputConfigs.length === 1) {
    const config = outputConfigs[0];
    const hasDuplicateName = duplicateNames.has(config.name);

    return (
      <View marginBottom="size-200" flex="none">
        <Flex direction="column" gap="size-100">
          <Heading level={2} weight="heavy">
            {title}
          </Heading>
          <Text color="text-500">{description}</Text>
          <OutputConfigItem
            config={config}
            index={0}
            isReadOnly={isReadOnly}
            hasDuplicateNameError={hasDuplicateName}
          />
          {!hideAddRemove && (
            <Button
              variant="default"
              size="S"
              onPress={handleAddConfig}
              leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
              css={css`
                width: fit-content;
              `}
            >
              Add Output Config
            </Button>
          )}
        </Flex>
      </View>
    );
  }

  // Multiple configs - render in accordion
  return (
    <View marginBottom="size-200" flex="none">
      <Flex direction="column" gap="size-100">
        <Heading level={2} weight="heavy">
          {title}
        </Heading>
        <Text color="text-500">{description}</Text>
        <DisclosureGroup
          css={css`
            margin-top: var(--ac-global-dimension-static-size-50);
            border: 1px solid var(--ac-global-border-color-default);
            border-radius: var(--ac-global-rounding-medium);
            overflow: hidden;
          `}
        >
          {outputConfigs.map((config, index) => {
            const hasDuplicateName = duplicateNames.has(config.name);
            return (
              <Disclosure key={index} id={`output-config-${index}`}>
                <DisclosureTrigger arrowPosition="start" width="100%">
                  <Flex
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    width="100%"
                    gap="size-100"
                  >
                    <Flex direction="row" alignItems="center" gap="size-100">
                      <Text weight="heavy">
                        {config.name || `Config ${index + 1}`}
                      </Text>
                      {"values" in config ? (
                        <Text
                          color="text-500"
                          size="XS"
                          css={css`
                            text-transform: uppercase;
                          `}
                        >
                          categorical
                        </Text>
                      ) : (
                        <Text
                          color="text-500"
                          size="XS"
                          css={css`
                            text-transform: uppercase;
                          `}
                        >
                          continuous
                        </Text>
                      )}
                      {hasDuplicateName && (
                        <Text color="danger" size="XS">
                          (duplicate name)
                        </Text>
                      )}
                    </Flex>
                    {!hideAddRemove && outputConfigs.length > 1 && (
                      <div
                        role="presentation"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="quiet"
                          size="S"
                          onPress={() => handleRemoveConfig(index)}
                          aria-label={`Remove ${config.name || `Config ${index + 1}`}`}
                        >
                          <Icon svg={<Icons.TrashOutline />} />
                        </Button>
                      </div>
                    )}
                  </Flex>
                </DisclosureTrigger>
                <DisclosurePanel>
                  <View padding="size-200">
                    <OutputConfigItem
                      config={config}
                      index={index}
                      isReadOnly={isReadOnly}
                      hasDuplicateNameError={hasDuplicateName}
                      hideNameLabel
                    />
                  </View>
                </DisclosurePanel>
              </Disclosure>
            );
          })}
        </DisclosureGroup>
        {!hideAddRemove && (
          <Button
            variant="default"
            size="S"
            onPress={handleAddConfig}
            leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
            css={css`
              width: fit-content;
            `}
          >
            Add Output Config
          </Button>
        )}
      </Flex>
    </View>
  );
};
