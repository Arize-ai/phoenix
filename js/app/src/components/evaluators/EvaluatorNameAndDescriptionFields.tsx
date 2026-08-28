import { Flex, View } from "@phoenix/components";
import { EvaluatorDescriptionInput } from "@phoenix/components/evaluators/EvaluatorDescriptionInput";
import { EvaluatorNameInput } from "@phoenix/components/evaluators/EvaluatorNameInput";

/**
 * The name and description inputs rendered at the top of an evaluator form's
 * left panel.
 */
export const EvaluatorNameAndDescriptionFields = ({
  onValueChange,
  isNameRequired = false,
  descriptionPlaceholder,
}: {
  onValueChange?: () => void;
  /** Marks the name input as required for form submission. */
  isNameRequired?: boolean;
  /** Overrides the description input's default example placeholder. */
  descriptionPlaceholder?: string;
} = {}) => (
  <View marginBottom="size-200" flex="none">
    <Flex direction="row" alignItems="baseline" width="100%" gap="size-100">
      <EvaluatorNameInput
        onValueChange={onValueChange}
        isRequired={isNameRequired}
      />
      <EvaluatorDescriptionInput
        onValueChange={onValueChange}
        placeholder={descriptionPlaceholder}
      />
    </Flex>
  </View>
);
