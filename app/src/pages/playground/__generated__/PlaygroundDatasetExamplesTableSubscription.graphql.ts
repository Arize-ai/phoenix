/**
 * @generated SignedSource<<72e9c4791ba06dcba603fc2412049648>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, GraphQLSubscription } from 'relay-runtime';
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
export type PlaygroundDatasetExamplesTableSubscription$variables = {
  input: ChatCompletionOverDatasetInput;
};
export type PlaygroundDatasetExamplesTableSubscription$data = {
  readonly chatCompletionOverDataset: {
    readonly __typename: "ChatCompletionSubscriptionError";
    readonly datasetExampleId: string | null;
    readonly message: string;
  } | {
    readonly __typename: "ChatCompletionSubscriptionExperiment";
    readonly experiment: {
      readonly id: string;
    };
  } | {
    readonly __typename: "ChatCompletionSubscriptionResult";
    readonly datasetExampleId: string | null;
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
    } | null;
  } | {
    readonly __typename: "TextChunk";
    readonly content: string;
    readonly datasetExampleId: string | null;
  } | {
    readonly __typename: "ToolCallChunk";
    readonly datasetExampleId: string | null;
    readonly function: {
      readonly arguments: string;
      readonly name: string;
    };
    readonly id: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type PlaygroundDatasetExamplesTableSubscription = {
  response: PlaygroundDatasetExamplesTableSubscription$data;
  variables: PlaygroundDatasetExamplesTableSubscription$variables;
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
  "name": "datasetExampleId",
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
  (v2/*: any*/)
],
v4 = [
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
    "name": "chatCompletionOverDataset",
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
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "content",
            "storageKey": null
          },
          (v1/*: any*/)
        ],
        "type": "TextChunk",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v2/*: any*/),
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
            "concreteType": "Experiment",
            "kind": "LinkedField",
            "name": "experiment",
            "plural": false,
            "selections": (v3/*: any*/),
            "storageKey": null
          }
        ],
        "type": "ChatCompletionSubscriptionExperiment",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v1/*: any*/),
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
                "selections": (v3/*: any*/),
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
          }
        ],
        "type": "ChatCompletionSubscriptionResult",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v1/*: any*/),
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
    "name": "PlaygroundDatasetExamplesTableSubscription",
    "selections": (v4/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundDatasetExamplesTableSubscription",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "b55d69e7e814bd7ad8803012b3417497",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableSubscription",
    "operationKind": "subscription",
    "text": "subscription PlaygroundDatasetExamplesTableSubscription(\n  $input: ChatCompletionOverDatasetInput!\n) {\n  chatCompletionOverDataset(input: $input) {\n    __typename\n    ... on TextChunk {\n      content\n      datasetExampleId\n    }\n    ... on ToolCallChunk {\n      id\n      datasetExampleId\n      function {\n        name\n        arguments\n      }\n    }\n    ... on ChatCompletionSubscriptionExperiment {\n      experiment {\n        id\n      }\n    }\n    ... on ChatCompletionSubscriptionResult {\n      datasetExampleId\n      span {\n        id\n        tokenCountCompletion\n        tokenCountPrompt\n        tokenCountTotal\n        latencyMs\n        project {\n          id\n        }\n        context {\n          traceId\n        }\n      }\n    }\n    ... on ChatCompletionSubscriptionError {\n      datasetExampleId\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "fe9812f39342e8e8cbb85b05f9443428";

export default node;
