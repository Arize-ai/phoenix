/**
 * @generated SignedSource<<3e580bbde6268cabcedb96d95e564c7f>>
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
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type ChatCompletionInput = {
  evaluators?: ReadonlyArray<PlaygroundEvaluatorInput>;
  invocationParameters?: ReadonlyArray<InvocationParameterInput>;
  messages: ReadonlyArray<ChatCompletionMessageInput>;
  model: GenerativeModelInput;
  promptName?: string | null;
  repetitions: number;
  template?: PromptTemplateOptions | null;
  tools?: ReadonlyArray<any> | null;
  tracingEnabled?: boolean;
};
export type ChatCompletionMessageInput = {
  content?: any;
  role: ChatCompletionMessageRole;
  toolCallId?: string | null;
  toolCalls?: ReadonlyArray<any> | null;
};
export type GenerativeModelInput = {
  builtin?: GenerativeModelBuiltinProviderInput | null;
  custom?: GenerativeModelCustomProviderInput | null;
};
export type GenerativeModelBuiltinProviderInput = {
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
export type PromptTemplateOptions = {
  format: PromptTemplateFormat;
  variables: any;
};
export type PlaygroundEvaluatorInput = {
  id: string;
  inputMapping?: EvaluatorInputMappingInput;
};
export type EvaluatorInputMappingInput = {
  literalMapping?: any;
  pathMapping?: any;
};
export type PlaygroundOutputMutation$variables = {
  input: ChatCompletionInput;
};
export type PlaygroundOutputMutation$data = {
  readonly chatCompletion: {
    readonly __typename: "ChatCompletionMutationPayload";
    readonly repetitions: ReadonlyArray<{
      readonly content: string | null;
      readonly errorMessage: string | null;
      readonly repetitionNumber: number;
      readonly span: {
        readonly id: string;
      } | null;
      readonly toolCalls: ReadonlyArray<{
        readonly function: {
          readonly arguments: string;
          readonly name: string;
        };
        readonly id: string;
      }>;
    }>;
  };
};
export type PlaygroundOutputMutation = {
  response: PlaygroundOutputMutation$data;
  variables: PlaygroundOutputMutation$variables;
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
    "concreteType": "ChatCompletionMutationPayload",
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
        "concreteType": "ChatCompletionRepetition",
        "kind": "LinkedField",
        "name": "repetitions",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "repetitionNumber",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "content",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "errorMessage",
            "storageKey": null
          },
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
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "ChatCompletionToolCall",
            "kind": "LinkedField",
            "name": "toolCalls",
            "plural": true,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "ChatCompletionFunctionCall",
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
    "name": "PlaygroundOutputMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundOutputMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "259654f688f4618f00b667c0a75b02dd",
    "id": null,
    "metadata": {},
    "name": "PlaygroundOutputMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundOutputMutation(\n  $input: ChatCompletionInput!\n) {\n  chatCompletion(input: $input) {\n    __typename\n    repetitions {\n      repetitionNumber\n      content\n      errorMessage\n      span {\n        id\n      }\n      toolCalls {\n        id\n        function {\n          name\n          arguments\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4d687fac3a1b0a13292c96cb6827c1bc";

export default node;
