/**
 * @generated SignedSource<<b2d394334da9b3ce4738fcdcea985036>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type CanonicalParameterName = "MAX_COMPLETION_TOKENS" | "RANDOM_SEED" | "RESPONSE_FORMAT" | "STOP_SEQUENCES" | "TEMPERATURE" | "TOOL_CHOICE" | "TOP_P";
export type ChatCompletionMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "GEMINI" | "OPENAI";
export type TemplateLanguage = "F_STRING" | "MUSTACHE";
export type ChatCompletionOverDatasetInput = {
  apiKey?: string | null;
  datasetId: string;
  datasetVersionId?: string | null;
  experimentDescription?: string | null;
  experimentMetadata?: any | null;
  experimentName?: string | null;
  invocationParameters?: ReadonlyArray<InvocationParameterInput>;
  messages: ReadonlyArray<ChatCompletionMessageInput>;
  model: GenerativeModelInput;
  templateLanguage: TemplateLanguage;
  tools?: ReadonlyArray<any> | null;
};
export type ChatCompletionMessageInput = {
  content?: any;
  role: ChatCompletionMessageRole;
  toolCallId?: string | null;
  toolCalls?: ReadonlyArray<any> | null;
};
export type GenerativeModelInput = {
  apiVersion?: string | null;
  endpoint?: string | null;
  name: string;
  providerKey: GenerativeProviderKey;
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
export type PlaygroundDatasetExamplesTableMutation$variables = {
  input: ChatCompletionOverDatasetInput;
};
export type PlaygroundDatasetExamplesTableMutation$data = {
  readonly chatCompletionOverDataset: {
    readonly __typename: "ChatCompletionOverDatasetMutationPayload";
    readonly examples: ReadonlyArray<{
      readonly datasetExampleId: string;
      readonly result: {
        readonly __typename: "ChatCompletionMutationError";
        readonly message: string;
      } | {
        readonly __typename: "ChatCompletionMutationPayload";
        readonly content: string | null;
        readonly errorMessage: string | null;
        readonly span: {
          readonly context: {
            readonly traceId: string;
          };
          readonly id: string;
          readonly latencyMs: number | null;
          readonly project: {
            readonly id: string;
          };
          readonly tokenCountCompletion: number | null;
          readonly tokenCountPrompt: number | null;
          readonly tokenCountTotal: number | null;
        };
        readonly toolCalls: ReadonlyArray<{
          readonly function: {
            readonly arguments: string;
            readonly name: string;
          };
          readonly id: string;
        }>;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      };
    }>;
    readonly experimentId: string;
  };
};
export type PlaygroundDatasetExamplesTableMutation = {
  response: PlaygroundDatasetExamplesTableMutation$data;
  variables: PlaygroundDatasetExamplesTableMutation$variables;
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
  "name": "__typename",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "ChatCompletionOverDatasetMutationPayload",
    "kind": "LinkedField",
    "name": "chatCompletionOverDataset",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "experimentId",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ChatCompletionOverDatasetMutationExamplePayload",
        "kind": "LinkedField",
        "name": "examples",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "datasetExampleId",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": null,
            "kind": "LinkedField",
            "name": "result",
            "plural": false,
            "selections": [
              (v1/*: any*/),
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
                "type": "ChatCompletionMutationError",
                "abstractKey": null
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
                      (v2/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "tokenCountCompletion",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "tokenCountPrompt",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "tokenCountTotal",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "latencyMs",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "Project",
                        "kind": "LinkedField",
                        "name": "project",
                        "plural": false,
                        "selections": [
                          (v2/*: any*/)
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SpanContext",
                        "kind": "LinkedField",
                        "name": "context",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "traceId",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
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
                      (v2/*: any*/),
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
                "type": "ChatCompletionMutationPayload",
                "abstractKey": null
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
    "name": "PlaygroundDatasetExamplesTableMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundDatasetExamplesTableMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "5545ba76d6e030f32efac014aec91639",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundDatasetExamplesTableMutation(\n  $input: ChatCompletionOverDatasetInput!\n) {\n  chatCompletionOverDataset(input: $input) {\n    __typename\n    experimentId\n    examples {\n      datasetExampleId\n      result {\n        __typename\n        ... on ChatCompletionMutationError {\n          message\n        }\n        ... on ChatCompletionMutationPayload {\n          content\n          errorMessage\n          span {\n            id\n            tokenCountCompletion\n            tokenCountPrompt\n            tokenCountTotal\n            latencyMs\n            project {\n              id\n            }\n            context {\n              traceId\n            }\n          }\n          toolCalls {\n            id\n            function {\n              name\n              arguments\n            }\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "bc4fd259c609ba1bda148c079b26b0d3";

export default node;
