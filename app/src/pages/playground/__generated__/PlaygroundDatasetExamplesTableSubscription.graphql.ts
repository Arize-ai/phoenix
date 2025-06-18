/**
 * @generated SignedSource<<61c496538f5df303e631399e96c534e5>>
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
export type ChatCompletionOverDatasetInput = {
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  datasetId: string;
  datasetVersionId?: string | null;
  experimentDescription?: string | null;
  experimentMetadata?: any | null;
  experimentName?: string | null;
  invocationParameters?: ReadonlyArray<InvocationParameterInput>;
  messages: ReadonlyArray<ChatCompletionMessageInput>;
  model: GenerativeModelInput;
  promptName?: string | null;
  templateFormat?: PromptTemplateFormat;
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
  baseUrl?: string | null;
  endpoint?: string | null;
  name: string;
  providerKey: GenerativeProviderKey;
  region?: string | null;
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
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
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
    readonly experimentRun: {
      readonly id: string;
    } | null;
    readonly span: {
      readonly context: {
        readonly traceId: string;
      };
      readonly cost: {
        readonly totalCost: number | null;
      } | null;
      readonly id: string;
      readonly latencyMs: number | null;
      readonly project: {
        readonly id: string;
      };
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
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "datasetExampleId",
  "storageKey": null
},
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "content",
      "storageKey": null
    },
    (v3/*: any*/)
  ],
  "type": "TextChunk",
  "abstractKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "kind": "InlineFragment",
  "selections": [
    (v5/*: any*/),
    (v3/*: any*/),
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
v7 = [
  (v5/*: any*/)
],
v8 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "Experiment",
      "kind": "LinkedField",
      "name": "experiment",
      "plural": false,
      "selections": (v7/*: any*/),
      "storageKey": null
    }
  ],
  "type": "ChatCompletionSubscriptionExperiment",
  "abstractKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenCountTotal",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "totalCost",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": (v7/*: any*/),
  "storageKey": null
},
v13 = {
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
},
v14 = {
  "alias": null,
  "args": null,
  "concreteType": "ExperimentRun",
  "kind": "LinkedField",
  "name": "experimentRun",
  "plural": false,
  "selections": (v7/*: any*/),
  "storageKey": null
},
v15 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundDatasetExamplesTableSubscription",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "chatCompletionOverDataset",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v4/*: any*/),
          (v6/*: any*/),
          (v8/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "span",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v9/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SpanCost",
                    "kind": "LinkedField",
                    "name": "cost",
                    "plural": false,
                    "selections": [
                      (v10/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v11/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/)
                ],
                "storageKey": null
              },
              (v14/*: any*/)
            ],
            "type": "ChatCompletionSubscriptionResult",
            "abstractKey": null
          },
          (v15/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundDatasetExamplesTableSubscription",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "chatCompletionOverDataset",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v4/*: any*/),
          (v6/*: any*/),
          (v8/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "span",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v9/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SpanCost",
                    "kind": "LinkedField",
                    "name": "cost",
                    "plural": false,
                    "selections": [
                      (v10/*: any*/),
                      (v5/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v11/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/)
                ],
                "storageKey": null
              },
              (v14/*: any*/)
            ],
            "type": "ChatCompletionSubscriptionResult",
            "abstractKey": null
          },
          (v15/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f5972595e62309772522f20794faa009",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetExamplesTableSubscription",
    "operationKind": "subscription",
    "text": "subscription PlaygroundDatasetExamplesTableSubscription(\n  $input: ChatCompletionOverDatasetInput!\n) {\n  chatCompletionOverDataset(input: $input) {\n    __typename\n    ... on TextChunk {\n      content\n      datasetExampleId\n    }\n    ... on ToolCallChunk {\n      id\n      datasetExampleId\n      function {\n        name\n        arguments\n      }\n    }\n    ... on ChatCompletionSubscriptionExperiment {\n      experiment {\n        id\n      }\n    }\n    ... on ChatCompletionSubscriptionResult {\n      datasetExampleId\n      span {\n        id\n        tokenCountTotal\n        cost {\n          totalCost\n          id\n        }\n        latencyMs\n        project {\n          id\n        }\n        context {\n          traceId\n        }\n      }\n      experimentRun {\n        id\n      }\n    }\n    ... on ChatCompletionSubscriptionError {\n      datasetExampleId\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9d6f975b3405ef1d2b27244224be9ccc";

export default node;
