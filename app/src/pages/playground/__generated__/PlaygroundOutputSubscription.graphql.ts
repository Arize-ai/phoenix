/**
 * @generated SignedSource<<47da9ad05318801a4df2822b077123e3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type ChatCompletionInput = {
  clientOptions?: ModelClientOptionsInput | null;
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  evaluators?: ReadonlyArray<PlaygroundEvaluatorInput>;
  promptName?: string | null;
  promptVersion: ChatPromptVersionInput;
  repetitions: number;
  streamModelOutput?: boolean;
  template?: PromptTemplateOptions | null;
};
export type ChatPromptVersionInput = {
  customProviderId?: string | null;
  description?: string | null;
  invocationParameters?: any;
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
export type PromptToolsInput = {
  disableParallelToolCalls?: boolean | null;
  toolChoice?: PromptToolChoiceInput | null;
  tools: ReadonlyArray<PromptToolFunctionInput>;
};
export type PromptToolFunctionInput = {
  function: PromptToolFunctionDefinitionInput;
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
export type ModelClientOptionsInput = {
  builtin?: BuiltinClientOptionsInput | null;
  custom?: CustomClientOptionsInput | null;
};
export type BuiltinClientOptionsInput = {
  baseUrl?: string | null;
  customHeaders?: any | null;
  endpoint?: string | null;
  openaiApiType?: OpenAIApiType | null;
  region?: string | null;
};
export type CustomClientOptionsInput = {
  extraHeaders?: any | null;
};
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type PromptTemplateOptions = {
  format: PromptTemplateFormat;
  variables: any;
};
export type PlaygroundEvaluatorInput = {
  description?: string | null;
  id: string;
  inputMapping?: EvaluatorInputMappingInput;
  name: string;
  outputConfigs?: ReadonlyArray<AnnotationConfigInput> | null;
};
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
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
  name: string;
};
export type PlaygroundOutputSubscription$variables = {
  input: ChatCompletionInput;
};
export type PlaygroundOutputSubscription$data = {
  readonly chatCompletion: {
    readonly __typename: string;
    readonly content?: string;
    readonly function?: {
      readonly arguments: string;
      readonly name: string;
    };
    readonly id?: string;
    readonly message?: string;
    readonly repetitionNumber: number | null;
    readonly span?: {
      readonly id: string;
    } | null;
  };
};
export type PlaygroundOutputSubscription = {
  response: PlaygroundOutputSubscription$data;
  variables: PlaygroundOutputSubscription$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": null,
    "kind": "LinkedField",
    "name": "chatCompletion",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "repetitionNumber",
        "storageKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "content",
            "storageKey": null
          }
        ],
        "type": "TextChunk",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "FunctionCallChunk",
            "kind": "LinkedField",
            "name": "function",
            "plural": false,
            "selections": [
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
                "name": "arguments",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "type": "ToolCallChunk",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Span",
            "kind": "LinkedField",
            "name": "span",
            "plural": false,
            "selections": [
              (v1/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "type": "ChatCompletionSubscriptionResult",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "message",
            "storageKey": null
          }
        ],
        "type": "ChatCompletionSubscriptionError",
        "abstractKey": null
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
    "name": "PlaygroundOutputSubscription",
    "selections": (v2/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundOutputSubscription",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "e74612af0887018cc61d185ed2105c5c",
    "id": null,
    "metadata": {},
    "name": "PlaygroundOutputSubscription",
    "operationKind": "subscription",
    "text": "subscription PlaygroundOutputSubscription(\n  $input: ChatCompletionInput!\n) {\n  chatCompletion(input: $input) {\n    __typename\n    repetitionNumber\n    ... on TextChunk {\n      content\n    }\n    ... on ToolCallChunk {\n      id\n      function {\n        name\n        arguments\n      }\n    }\n    ... on ChatCompletionSubscriptionResult {\n      span {\n        id\n      }\n    }\n    ... on ChatCompletionSubscriptionError {\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "964992cecd018dc17131050b7553a3d1";

export default node;
