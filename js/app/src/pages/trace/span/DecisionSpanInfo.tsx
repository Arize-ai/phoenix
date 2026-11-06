import { Flex } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative";
import { isModelProvider } from "@phoenix/utils/generativeUtils";

import { SpanInput } from "./SpanInput";
import { SpanOutput } from "./SpanOutput";
import type { AttributeObject, SpanInfoData } from "./types";
import { getDecisionAttributes } from "./utils";

/**
 * The model name for the decision input card's header, led by the provider
 * icon when the provider is one Phoenix has an icon for.
 */
function DecisionModelSubtitle({
  modelName,
  provider,
}: {
  modelName: string;
  provider: string | null;
}) {
  const normalizedProvider = provider?.toUpperCase();
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      {typeof normalizedProvider === "string" &&
      isModelProvider(normalizedProvider) ? (
        <GenerativeProviderIcon provider={normalizedProvider} height={16} />
      ) : null}
      {modelName}
    </Flex>
  );
}

/**
 * The info view for a decision span — the decision input / output with the
 * decision model named in the input card's header.
 */
export function DecisionSpanInfo({
  span,
  spanAttributes,
}: {
  span: SpanInfoData;
  spanAttributes: AttributeObject;
}) {
  const { input, output } = span;
  const { modelName, provider } = getDecisionAttributes(spanAttributes);
  return (
    <Flex direction="column" gap="size-200">
      {input && input.value != null ? (
        <SpanInput
          {...input}
          subTitle={
            modelName != null ? (
              <DecisionModelSubtitle
                modelName={modelName}
                provider={provider}
              />
            ) : undefined
          }
        />
      ) : null}
      {output && output.value != null ? <SpanOutput {...output} /> : null}
    </Flex>
  );
}
