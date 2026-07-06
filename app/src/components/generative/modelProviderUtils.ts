import type {
  GenerativeModelSDK,
  GenerativeProviderKey,
} from "./__generated__/useModelMenuDataQuery.graphql";

const GENERATIVE_MODEL_SDK_TO_PROVIDER_KEY: Record<
  GenerativeModelSDK,
  GenerativeProviderKey
> = {
  OPENAI: "OPENAI",
  AZURE_OPENAI: "AZURE_OPENAI",
  ANTHROPIC: "ANTHROPIC",
  AWS_BEDROCK: "AWS",
  GOOGLE_GENAI: "GOOGLE",
};

export function getProviderKeyForGenerativeModelSDK(
  sdk: GenerativeModelSDK
): GenerativeProviderKey {
  return GENERATIVE_MODEL_SDK_TO_PROVIDER_KEY[sdk];
}

export function applyBedrockModelPrefix({
  modelName,
  prefix,
}: {
  modelName: string;
  prefix: string;
}): string {
  const prefixDot = `${prefix}.`;
  return modelName.startsWith(prefixDot)
    ? modelName
    : `${prefixDot}${modelName}`;
}
