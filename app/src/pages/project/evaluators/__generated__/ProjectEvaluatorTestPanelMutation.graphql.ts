/**
 * @generated SignedSource<<5668ef59a701e5e8eb88df248ae9c604>>
 * @lightSyntaxTransform
 * @nogrep
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
  builtInEvaluatorId?: string | null;
  codeEvaluatorId?: string | null;
  inlineCodeEvaluator?: InlineCodeEvaluatorInput | null;
  inlineLlmEvaluator?: InlineLLMEvaluatorInput | null;
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
export type ProjectEvaluatorTestPanelMutation$variables = {
  input: EvaluatorPreviewsInput;
};
export type ProjectEvaluatorTestPanelMutation$data = {
  readonly evaluatorPreviews: {
    readonly results: ReadonlyArray<{
      readonly annotation: {
        readonly explanation: string | null;
        readonly label: string | null;
        readonly name: string;
        readonly score: number | null;
      } | null;
      readonly error: string | null;
      readonly evaluatorName: string;
    }>;
  };
};
export type ProjectEvaluatorTestPanelMutation = {
  response: ProjectEvaluatorTestPanelMutation$data;
  variables: ProjectEvaluatorTestPanelMutation$variables;
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatorName",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorTestPanelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
              (v2/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunAnnotation",
                "kind": "LinkedField",
                "name": "annotation",
                "plural": false,
                "selections": [
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/)
                ],
                "storageKey": null
              },
              (v7/*: any*/)
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectEvaluatorTestPanelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
              (v2/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ExperimentRunAnnotation",
                "kind": "LinkedField",
                "name": "annotation",
                "plural": false,
                "selections": [
                  (v3/*: any*/),
                  (v4/*: any*/),
                  (v5/*: any*/),
                  (v6/*: any*/),
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
              (v7/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b614c11a7730ff3f3cf9adcfe8bccea8",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorTestPanelMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectEvaluatorTestPanelMutation(\n  $input: EvaluatorPreviewsInput!\n) {\n  evaluatorPreviews(input: $input) {\n    results {\n      evaluatorName\n      annotation {\n        name\n        label\n        score\n        explanation\n        id\n      }\n      error\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f3b13ae8852a65d3c2364535034c40eb";

export default node;
