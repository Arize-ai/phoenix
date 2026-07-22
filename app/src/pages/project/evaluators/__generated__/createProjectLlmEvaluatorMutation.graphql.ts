/**
 * @generated SignedSource<<83cd982f0eed5dd41a5beab0b78c542b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnthropicOutputConfigEffort = "HIGH" | "LOW" | "MAX" | "MEDIUM" | "XHIGH";
export type AnthropicThinkingDisplay = "OMITTED" | "SUMMARIZED";
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type GoogleThinkingLevel = "HIGH" | "LOW" | "MEDIUM" | "MINIMAL";
export type OpenAIReasoningEffort = "HIGH" | "LOW" | "MEDIUM" | "MINIMAL" | "NONE" | "XHIGH";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type CreateProjectLLMEvaluatorInput = {
  description?: string | null;
  enabled?: boolean;
  evaluationTarget: EvaluationTarget;
  filterCondition?: string;
  inputMapping: EvaluatorInputMappingInput;
  name: string;
  outputConfigs: ReadonlyArray<AnnotationConfigInput>;
  projectId: string;
  promptVersion: ChatPromptVersionInput;
  promptVersionId?: string | null;
  samplingRate: number;
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
export type PromptInvocationParametersInput = {
  anthropic?: PromptAnthropicInvocationParametersInput | null;
  aws?: PromptAwsInvocationParametersInput | null;
  google?: PromptGoogleInvocationParametersInput | null;
  openai?: PromptOpenAIInvocationParametersInput | null;
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
  adaptive?: AnthropicThinkingAdaptiveInput | null;
  disabled?: AnthropicThinkingDisabledMarkerInput | null;
  enabled?: AnthropicThinkingEnabledInput | null;
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
  function?: PromptToolFunctionDefinitionInput | null;
  raw?: any | null;
};
export type PromptToolFunctionDefinitionInput = {
  description?: string | null;
  name: string;
  parameters?: any | null;
  strict?: boolean | null;
};
export type PromptToolChoiceInput = {
  functionName?: string | null;
  none?: boolean | null;
  oneOrMore?: boolean | null;
  zeroOrMore?: boolean | null;
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
  categorical?: CategoricalAnnotationConfigInput | null;
  continuous?: ContinuousAnnotationConfigInput | null;
  freeform?: FreeformAnnotationConfigInput | null;
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
export type EvaluatorInputMappingInput = {
  literalMapping: any;
  pathMapping: any;
};
export type createProjectLlmEvaluatorMutation$variables = {
  connectionIds: ReadonlyArray<string>;
  input: CreateProjectLLMEvaluatorInput;
};
export type createProjectLlmEvaluatorMutation$data = {
  readonly createProjectLlmEvaluator: {
    readonly evaluator: {
      readonly enabled: boolean;
      readonly evaluationTarget: EvaluationTarget;
      readonly evaluator: {
        readonly kind: EvaluatorKind;
      };
      readonly filterCondition: string;
      readonly id: string;
      readonly name: string;
      readonly samplingRate: number;
    };
  };
};
export type createProjectLlmEvaluatorMutation = {
  response: createProjectLlmEvaluatorMutation$data;
  variables: createProjectLlmEvaluatorMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionIds"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluationTarget",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "filterCondition",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "samplingRate",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "enabled",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "createProjectLlmEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ProjectEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "createProjectLlmEvaluator",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectEvaluator",
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  (v9/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "createProjectLlmEvaluatorMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ProjectEvaluatorMutationPayload",
        "kind": "LinkedField",
        "name": "createProjectLlmEvaluator",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectEvaluator",
            "kind": "LinkedField",
            "name": "evaluator",
            "plural": false,
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "evaluator",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  (v9/*: any*/),
                  (v3/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "appendNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "evaluator",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connectionIds"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "ProjectEvaluatorEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c78ad4cc5d355fdb97472a6cb3a32c5f",
    "id": null,
    "metadata": {},
    "name": "createProjectLlmEvaluatorMutation",
    "operationKind": "mutation",
    "text": "mutation createProjectLlmEvaluatorMutation(\n  $input: CreateProjectLLMEvaluatorInput!\n) {\n  createProjectLlmEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      evaluationTarget\n      filterCondition\n      samplingRate\n      enabled\n      evaluator {\n        __typename\n        kind\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8cf7c19e863336008ff4bed5b9077cef";

export default node;
