/**
 * @generated SignedSource<<3e27b13ee6b2edbb40af67fa29ab8590>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CanonicalParameterName = "ANTHROPIC_EXTENDED_THINKING" | "MAX_COMPLETION_TOKENS" | "RANDOM_SEED" | "REASONING_EFFORT" | "RESPONSE_FORMAT" | "STOP_SEQUENCES" | "TEMPERATURE" | "TOOL_CHOICE" | "TOP_P";
export type ChatCompletionMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type ModelProvider = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type EvaluatorPreviewItemInput = {
  contexts: ReadonlyArray<any>;
  evaluator: EvaluatorPreviewInput;
  generationConfig?: GenerationConfigInput | null;
  inputMapping?: EvaluatorInputMappingInput;
  model?: GenerativeModelInput | null;
};
export type EvaluatorPreviewInput = {
  evaluatorId?: string | null;
  inlineLlmEvaluator?: InlineLLMEvaluatorInput | null;
};
export type InlineLLMEvaluatorInput = {
  description?: string | null;
  model: GenerativeModelInput;
  outputConfig: CategoricalAnnotationConfigInput;
  promptVersion: ChatPromptVersionInput;
};
export type GenerativeModelInput = {
  builtin?: GenerativeModelBuiltinProviderInput | null;
  custom?: GenerativeModelCustomProviderInput | null;
};
export type GenerativeModelBuiltinProviderInput = {
  apiVersion?: string | null;
  baseUrl?: string | null;
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  customHeaders?: any | null;
  endpoint?: string | null;
  name: string;
  providerKey: GenerativeProviderKey;
  region?: string | null;
};
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type GenerativeModelCustomProviderInput = {
  extraHeaders?: any | null;
  modelName: string;
  provider: string;
  providerId: string;
};
export type ChatPromptVersionInput = {
  description?: string | null;
  invocationParameters?: any;
  modelName: string;
  modelProvider: ModelProvider;
  responseFormat?: ResponseFormatInput | null;
  template: PromptChatTemplateInput;
  templateFormat: PromptTemplateFormat;
  tools?: ReadonlyArray<ToolDefinitionInput>;
};
export type PromptChatTemplateInput = {
  messages: ReadonlyArray<PromptMessageInput>;
};
export type PromptMessageInput = {
  content: ReadonlyArray<ContentPartInput>;
  role: string;
};
export type ContentPartInput = {
  text?: TextContentValueInput | null;
  toolCall?: ToolCallContentValueInput | null;
  toolResult?: ToolResultContentValueInput | null;
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
export type ToolDefinitionInput = {
  definition: any;
};
export type ResponseFormatInput = {
  definition: any;
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
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
};
export type GenerationConfigInput = {
  invocationParameters?: ReadonlyArray<InvocationParameterInput>;
  messages: ReadonlyArray<ChatCompletionMessageInput>;
  model: GenerativeModelInput;
  templateFormat?: PromptTemplateFormat;
  tools?: ReadonlyArray<any> | null;
};
export type ChatCompletionMessageInput = {
  content?: any;
  role: ChatCompletionMessageRole;
  toolCallId?: string | null;
  toolCalls?: ReadonlyArray<any> | null;
};
export type InvocationParameterInput = {
  canonicalName?: CanonicalParameterName | null;
  invocationName: string;
  valueBool?: boolean | null;
  valueBoolean?: boolean | null;
  valueFloat?: number | null;
  valueInt?: number | null;
  valueJson?: any | null;
  valueString?: string | null;
  valueStringList?: ReadonlyArray<string> | null;
};
export type EvaluatorOutputPreviewMutation$variables = {
  input: EvaluatorPreviewItemInput;
};
export type EvaluatorOutputPreviewMutation$data = {
  readonly evaluatorPreviews: {
    readonly results: ReadonlyArray<{
      readonly explanation: string | null;
      readonly id: string;
      readonly label: string | null;
      readonly name: string;
      readonly score: number | null;
    }>;
  };
};
export type EvaluatorOutputPreviewMutation = {
  response: EvaluatorOutputPreviewMutation$data;
  variables: EvaluatorOutputPreviewMutation$variables;
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
        "fields": [
          {
            "items": [
              {
                "kind": "Variable",
                "name": "previews.0",
                "variableName": "input"
              }
            ],
            "kind": "ListValue",
            "name": "previews"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "EvaluatorPreviewPayload",
    "kind": "LinkedField",
    "name": "evaluatorPreviews",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ExperimentRunAnnotation",
        "kind": "LinkedField",
        "name": "results",
        "plural": true,
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
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorOutputPreviewMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EvaluatorOutputPreviewMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "fba32baa71f836242f2533e0c7f89ec3",
    "id": null,
    "metadata": {},
    "name": "EvaluatorOutputPreviewMutation",
    "operationKind": "mutation",
    "text": "mutation EvaluatorOutputPreviewMutation(\n  $input: EvaluatorPreviewItemInput!\n) {\n  evaluatorPreviews(input: {previews: [$input]}) {\n    results {\n      explanation\n      label\n      score\n      name\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e6aba2d0f260338b482aae27099864b0";

export default node;
