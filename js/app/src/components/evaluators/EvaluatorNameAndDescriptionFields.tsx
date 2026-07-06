import { Flex, View } from "@phoenix/components";
import { EvaluatorDescriptionInput } from "@phoenix/components/evaluators/EvaluatorDescriptionInput";
import { EvaluatorNameInput } from "@phoenix/components/evaluators/EvaluatorNameInput";

/**
 * The name and description inputs rendered at the top of an evaluator form's
 * left panel.
 */
export const EvaluatorNameAndDescriptionFields = () => (
  <View marginBottom="size-200" flex="none">
    <Flex direction="row" alignItems="baseline" width="100%" gap="size-100">
      <EvaluatorNameInput />
      <EvaluatorDescriptionInput />
    </Flex>
  </View>
);
