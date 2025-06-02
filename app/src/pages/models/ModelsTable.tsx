import { css } from "@emotion/react";

import { Button, Flex, Icon, Icons, Token } from "@phoenix/components";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { selectableTableCSS } from "@phoenix/components/table/styles";

// LLM pricing data
const modelPricingData = [
  {
    id: "1",
    model: "gpt-4.1-2025-04-14",
    provider: "openai",
    input: "$0.0000020000",
    output: "$0.0000080000",
    cachedInput: "$0.0000005000",
    cacheWrite: "-",
    cacheRead: "-",
    maintainedBy: "local",
    regex: "^gpt-4\\.1-2025-04-14$",
  },
  {
    id: "2",
    model: "gpt-4.1-mini-2025-04-14",
    provider: "openai",
    input: "$0.0000004000",
    output: "$0.0000016000",
    cachedInput: "$0.0000001000",
    cacheWrite: "-",
    cacheRead: "-",
    maintainedBy: "override",
    regex: "^gpt-4\\.1-mini-2025-04-14$",
  },
  {
    id: "2a",
    model: "gpt-4.1-mini-2025-04-14",
    provider: "openai",
    input: "$0.0000004000",
    output: "$0.0000016000",
    cachedInput: "$0.0000001000",
    cacheWrite: "-",
    cacheRead: "-",
    maintainedBy: "local",
    regex: "^gpt-4\\.1-mini-2025-04-14$",
  },
  {
    id: "3",
    model: "gpt-4o-mini-2024-07-18",
    provider: "openai",
    input: "$0.0000001500",
    output: "$0.0000006000",
    cachedInput: "$0.0000000750",
    cacheWrite: "-",
    cacheRead: "-",
    maintainedBy: "local",
    regex: "^gpt-4o-mini-2024-07-18$",
  },
  {
    id: "4",
    model: "claude-3-7-sonnet-latest",
    provider: "anthropic",
    input: "0.000003",
    output: "0.000015",
    cachedInput: "-",
    cacheWrite: "0.00000375",
    cacheRead: "0.0000003",
    maintainedBy: "override",
    regex: "^claude-3-7-sonnet-latest$",
  },
  {
    id: "4a",
    model: "claude-3-7-sonnet-latest",
    provider: "anthropic",
    input: "0.000003",
    output: "0.000015",
    cachedInput: "-",
    cacheWrite: "0.00000375",
    cacheRead: "0.0000003",
    maintainedBy: "local",
    regex: "^claude-3-7-sonnet-latest$",
  },
  {
    id: "5",
    model: "claude-3-5-haiku-latest",
    provider: "anthropic",
    input: "0.0000008",
    output: "0.000004",
    cachedInput: "-",
    cacheWrite: "0.000001",
    cacheRead: "0.00000008",
    maintainedBy: "local",
    regex: "^claude-3-5-haiku-latest$",
  },
  {
    id: "6",
    model: "anthropic.claude-3-opus-20240229-v1:0",
    provider: "bedrock",
    input: "0.000015",
    output: "0.000075",
    cachedInput: "-",
    cacheWrite: "-",
    cacheRead: "-",
    maintainedBy: "override",
    regex: "^claude-3-opus-\\d{8}-v1:0$",
  },
  {
    id: "6a",
    model: "anthropic.claude-3-opus-20240229-v1:0",
    provider: "bedrock",
    input: "0.000015",
    output: "0.000075",
    cachedInput: "-",
    cacheWrite: "-",
    cacheRead: "-",
    maintainedBy: "local",
    regex: "^claude-3-opus-\\d{8}-v1:0$",
  },
  {
    id: "7",
    model: "Llama 3.3 Instruct (70B)",
    provider: "bedrock",
    input: "0.00000072",
    output: "0.00000072",
    cachedInput: "-",
    cacheWrite: "-",
    cacheRead: "-",
    maintainedBy: "local",
    regex: "^Llama 3\\.3 Instruct \\(70B\\)$",
  },
  {
    id: "8",
    model: "o1-2024-12-17",
    provider: "openai",
    input: "$0.0000150000",
    output: "$0.0000600000",
    cachedInput: "$0.0000075000",
    cacheWrite: "-",
    cacheRead: "-",
    maintainedBy: "override",
    regex: "^o1-2024-12-17$",
  },
  {
    id: "8a",
    model: "o1-2024-12-17",
    provider: "openai",
    input: "$0.0000150000",
    output: "$0.0000600000",
    cachedInput: "$0.0000075000",
    cacheWrite: "-",
    cacheRead: "-",
    maintainedBy: "local",
    regex: "^o1-2024-12-17$",
  },
];

const formatPrice = (price: string) => {
  if (price === "-") return price;
  // Handle both formats: $0.0000020000 and 0.000003
  if (price.startsWith("$")) {
    const num = parseFloat(price.substring(1));
    return `$${num.toFixed(8)}`;
  } else {
    const num = parseFloat(price);
    return num.toFixed(8);
  }
};

const getProviderIcon = (provider: string) => {
  const providerMap: Record<
    string,
    "OPENAI" | "ANTHROPIC" | "AZURE_OPENAI" | "GOOGLE" | "DEEPSEEK" | "XAI"
  > = {
    openai: "OPENAI",
    anthropic: "ANTHROPIC",
    azure: "AZURE_OPENAI",
    google: "GOOGLE",
    deepseek: "DEEPSEEK",
    xai: "XAI",
  };

  return providerMap[provider.toLowerCase()];
};

const getMaintainedByColor = (maintainedBy: string) => {
  switch (maintainedBy) {
    case "local":
      return "emerald";
    case "override":
      return "orange";
    default:
      return "gray";
  }
};

const handleEditModelConfig = (_modelId: string, _modelName: string) => {
  // TODO: Implement edit model config functionality
  // This could open a modal, navigate to an edit page, etc.
};

export function ModelsTable() {
  return (
    <div
      css={css`
        flex: 1 1 auto;
        overflow: auto;
      `}
    >
      <table css={selectableTableCSS}>
        <thead>
          <tr>
            <th>Model</th>
            <th>Provider</th>
            <th>Maintained By</th>
            <th>Input Cost</th>
            <th>Output Cost</th>
            <th>Cached Input</th>
            <th>Cache Write</th>
            <th>Cache Read</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {modelPricingData.map((model) => (
            <tr key={model.id}>
              <td>
                <span
                  css={css`
                    font-weight: 500;
                    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
                    font-size: 13px;
                  `}
                >
                  {model.model}
                </span>
              </td>
              <td>
                <Flex justifyContent="start" alignItems="center" gap="size-100">
                  {getProviderIcon(model.provider) ? (
                    <>
                      <GenerativeProviderIcon
                        provider={getProviderIcon(model.provider)!}
                        height={16}
                      />
                      <span
                        css={css`
                          font-size: 14px;
                          color: var(--phoenix-color-text-primary);
                        `}
                      >
                        {model.provider}
                      </span>
                    </>
                  ) : (
                    <Token color="blue">{model.provider}</Token>
                  )}
                </Flex>
              </td>
              <td>
                <Flex justifyContent="start">
                  <Token color={getMaintainedByColor(model.maintainedBy)}>
                    {model.maintainedBy}
                  </Token>
                </Flex>
              </td>
              <td>
                <span
                  css={css`
                    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
                    font-size: 12px;
                    color: var(--phoenix-color-text-secondary);
                  `}
                >
                  {formatPrice(model.input)}
                </span>
              </td>
              <td>
                <span
                  css={css`
                    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
                    font-size: 12px;
                    color: var(--phoenix-color-text-secondary);
                  `}
                >
                  {formatPrice(model.output)}
                </span>
              </td>
              <td>
                <span
                  css={css`
                    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
                    font-size: 12px;
                    color: var(--phoenix-color-text-secondary);
                  `}
                >
                  {formatPrice(model.cachedInput)}
                </span>
              </td>
              <td>
                <span
                  css={css`
                    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
                    font-size: 12px;
                    color: var(--phoenix-color-text-secondary);
                  `}
                >
                  {formatPrice(model.cacheWrite)}
                </span>
              </td>
              <td>
                <span
                  css={css`
                    font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
                    font-size: 12px;
                    color: var(--phoenix-color-text-secondary);
                  `}
                >
                  {formatPrice(model.cacheRead)}
                </span>
              </td>
              <td>
                <Flex justifyContent="end" width="100%">
                  <Button
                    size="S"
                    variant="default"
                    leadingVisual={<Icon svg={<Icons.EditOutline />} />}
                    onPress={() => handleEditModelConfig(model.id, model.model)}
                  >
                    Edit
                  </Button>
                </Flex>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
