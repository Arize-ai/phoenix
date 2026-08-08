/**
 * @generated SignedSource<<0c4285be75822b9be5988a347b88aa66>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnthropicOutputConfigEffort = "HIGH" | "LOW" | "MAX" | "MEDIUM" | "XHIGH";
export type AnthropicThinkingDisplay = "OMITTED" | "SUMMARIZED";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type GoogleThinkingLevel = "HIGH" | "LOW" | "MEDIUM" | "MINIMAL";
export type Language = "PYTHON" | "TYPESCRIPT";
export type OpenAIReasoningEffort = "HIGH" | "LOW" | "MEDIUM" | "MINIMAL" | "NONE" | "XHIGH";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type EvaluatorPreviewsInput = {
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  previews: ReadonlyArray<EvaluatorPreviewItemInput>;
};
export type EvaluatorPreviewItemInput = {
  context: any;
  evaluator: EvaluatorPreviewInput;
  inputMapping: EvaluatorInputMappingInput;
};
export type EvaluatorPreviewInput = {
  builtInEvaluatorId: string;
  codeEvaluatorId?: never;
  inlineCodeEvaluator?: never;
  inlineLlmEvaluator?: never;
} | {
  builtInEvaluatorId?: never;
  codeEvaluatorId?: never;
  inlineCodeEvaluator?: never;
  inlineLlmEvaluator: InlineLLMEvaluatorInput;
} | {
  builtInEvaluatorId?: never;
  codeEvaluatorId: string;
  inlineCodeEvaluator?: never;
  inlineLlmEvaluator?: never;
} | {
  builtInEvaluatorId?: never;
  codeEvaluatorId?: never;
  inlineCodeEvaluator: InlineCodeEvaluatorInput;
  inlineLlmEvaluator?: never;
};
export type InlineLLMEvaluatorInput = {
  description?: string | null;
  name: string;
  outputConfigs: ReadonlyArray<AnnotationConfigInput>;
  promptVersion: ChatPromptVersionInput;
};
export type ChatPromptVersionInput = {
  customProviderId?: string | null;
  description?: string | null;
  invocationParameters: PromptInvocationParametersInput;
  modelName: string;
  modelProvider: GenerativeProviderKey;
  responseFormat?: PromptResponseFormatJSONSchemaInput | null;
  template: PromptChatTemplateInput;
  templateFormat: PromptTemplateFormat;
  tools?: PromptToolsInput | null;
};
export type PromptChatTemplateInput = {
  messages: ReadonlyArray<PromptMessageInput>;
};
export type PromptMessageInput = {
  content: ReadonlyArray<ContentPartInput>;
  role: PromptMessageRole;
};
export type ContentPartInput = {
  text: TextContentValueInput;
  toolCall?: never;
  toolResult?: never;
} | {
  text?: never;
  toolCall: ToolCallContentValueInput;
  toolResult?: never;
} | {
  text?: never;
  toolCall?: never;
  toolResult: ToolResultContentValueInput;
};
export type TextContentValueInput = {
  text: string;
};
export type ToolCallContentValueInput = {
  toolCall: ToolCallFunctionInput;
  toolCallId: string;
};
export type ToolCallFunctionInput = {
  arguments: string;
  name: string;
  type?: string | null;
};
export type ToolResultContentValueInput = {
  result: any;
  toolCallId: string;
};
export type PromptInvocationParametersInput = {
  anthropic?: never;
  aws?: never;
  google?: never;
  openai: PromptOpenAIInvocationParametersInput;
} | {
  anthropic: PromptAnthropicInvocationParametersInput;
  aws?: never;
  google?: never;
  openai?: never;
} | {
  anthropic?: never;
  aws?: never;
  google: PromptGoogleInvocationParametersInput;
  openai?: never;
} | {
  anthropic?: never;
  aws: PromptAwsInvocationParametersInput;
  google?: never;
  openai?: never;
};
export type PromptOpenAIInvocationParametersInput = {
  extraBody?: any | null;
  frequencyPenalty?: number | null;
  maxCompletionTokens?: number | null;
  maxTokens?: number | null;
  presencePenalty?: number | null;
  reasoningEffort?: OpenAIReasoningEffort | null;
  seed?: number | null;
  stop?: ReadonlyArray<string> | null;
  temperature?: number | null;
  topP?: number | null;
};
export type PromptAnthropicInvocationParametersInput = {
  extraBody?: any | null;
  maxTokens: number;
  outputConfig?: PromptAnthropicOutputConfigInput | null;
  stopSequences?: ReadonlyArray<string> | null;
  temperature?: number | null;
  thinking?: PromptAnthropicThinkingConfigInput | null;
  topP?: number | null;
};
export type PromptAnthropicOutputConfigInput = {
  effort?: AnthropicOutputConfigEffort | null;
};
export type PromptAnthropicThinkingConfigInput = {
  adaptive?: never;
  disabled: AnthropicThinkingDisabledMarkerInput;
  enabled?: never;
} | {
  adaptive?: never;
  disabled?: never;
  enabled: AnthropicThinkingEnabledInput;
} | {
  adaptive: AnthropicThinkingAdaptiveInput;
  disabled?: never;
  enabled?: never;
};
export type AnthropicThinkingDisabledMarkerInput = {
  disabled?: boolean;
};
export type AnthropicThinkingEnabledInput = {
  budgetTokens: number;
  display?: AnthropicThinkingDisplay | null;
};
export type AnthropicThinkingAdaptiveInput = {
  display?: AnthropicThinkingDisplay | null;
};
export type PromptGoogleInvocationParametersInput = {
  frequencyPenalty?: number | null;
  maxOutputTokens?: number | null;
  presencePenalty?: number | null;
  stopSequences?: ReadonlyArray<string> | null;
  temperature?: number | null;
  thinkingConfig?: PromptGoogleThinkingConfigInput | null;
  topK?: number | null;
  topP?: number | null;
};
export type PromptGoogleThinkingConfigInput = {
  includeThoughts?: boolean | null;
  thinkingBudget?: number | null;
  thinkingLevel?: GoogleThinkingLevel | null;
};
export type PromptAwsInvocationParametersInput = {
  maxTokens?: number | null;
  stopSequences?: ReadonlyArray<string> | null;
  temperature?: number | null;
  topP?: number | null;
};
export type PromptToolsInput = {
  disableParallelToolCalls?: boolean | null;
  toolChoice?: PromptToolChoiceInput | null;
  tools: ReadonlyArray<PromptToolInput>;
};
export type PromptToolInput = {
  function: PromptToolFunctionDefinitionInput;
  raw?: never;
} | {
  function?: never;
  raw: any;
};
export type PromptToolFunctionDefinitionInput = {
  description?: string | null;
  name: string;
  parameters?: any | null;
  strict?: boolean | null;
};
export type PromptToolChoiceInput = {
  functionName?: never;
  none: boolean;
  oneOrMore?: never;
  zeroOrMore?: never;
} | {
  functionName?: never;
  none?: never;
  oneOrMore?: never;
  zeroOrMore: boolean;
} | {
  functionName?: never;
  none?: never;
  oneOrMore: boolean;
  zeroOrMore?: never;
} | {
  functionName: string;
  none?: never;
  oneOrMore?: never;
  zeroOrMore?: never;
};
export type PromptResponseFormatJSONSchemaInput = {
  jsonSchema: PromptResponseFormatJSONSchemaDefinitionInput;
  type: string;
};
export type PromptResponseFormatJSONSchemaDefinitionInput = {
  description?: string | null;
  name: string;
  schema?: any | null;
  strict?: boolean | null;
};
export type AnnotationConfigInput = {
  categorical: CategoricalAnnotationConfigInput;
  continuous?: never;
  freeform?: never;
} | {
  categorical?: never;
  continuous: ContinuousAnnotationConfigInput;
  freeform?: never;
} | {
  categorical?: never;
  continuous?: never;
  freeform: FreeformAnnotationConfigInput;
};
export type CategoricalAnnotationConfigInput = {
  description?: string | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  values: ReadonlyArray<CategoricalAnnotationConfigValueInput>;
};
export type CategoricalAnnotationConfigValueInput = {
  label: string;
  score?: number | null;
};
export type ContinuousAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection: OptimizationDirection;
  upperBound?: number | null;
};
export type FreeformAnnotationConfigInput = {
  description?: string | null;
  lowerBound?: number | null;
  name: string;
  optimizationDirection?: OptimizationDirection | null;
  threshold?: number | null;
  upperBound?: number | null;
};
export type InlineCodeEvaluatorInput = {
  description?: string | null;
  language: Language;
  name: string;
  outputConfigs: ReadonlyArray<AnnotationConfigInput>;
  sandboxConfigId?: string | null;
  sourceCode: string;
};
export type EvaluatorInputMappingInput = {
  literalMapping: any;
  pathMapping: any;
};
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type CodeEvaluatorTestSectionMutation$variables = {
  input: EvaluatorPreviewsInput;
};
export type CodeEvaluatorTestSectionMutation$data = {
  readonly evaluatorPreviews: {
    readonly results: ReadonlyArray<{
      readonly annotation: {
        readonly explanation: string | null;
        readonly id: string;
        readonly label: string | null;
        readonly name: string;
        readonly score: number | null;
      } | null;
      readonly error: string | null;
      readonly evaluatorName: string;
    }>;
  };
};
export type CodeEvaluatorTestSectionMutation = {
  response: CodeEvaluatorTestSectionMutation$data;
  variables: CodeEvaluatorTestSectionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "EvaluatorPreviewsPayload",
    "kind": "LinkedField",
    "name": "evaluatorPreviews",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "EvaluationResult",
        "kind": "LinkedField",
        "name": "results",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "evaluatorName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "ExperimentRunAnnotation",
            "kind": "LinkedField",
            "name": "annotation",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "explanation",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "label",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "score",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "error",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CodeEvaluatorTestSectionMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "CodeEvaluatorTestSectionMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "880a87909fde069d7330f259c8cea2a2",
    "id": null,
    "metadata": {},
    "name": "CodeEvaluatorTestSectionMutation",
    "operationKind": "mutation",
    "text": "mutation CodeEvaluatorTestSectionMutation(\n  $input: EvaluatorPreviewsInput!\n) {\n  evaluatorPreviews(input: $input) {\n    results {\n      evaluatorName\n      annotation {\n        explanation\n        label\n        score\n        name\n        id\n      }\n      error\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "51564928488b73ce3754b374762baa5a";

export default node;
