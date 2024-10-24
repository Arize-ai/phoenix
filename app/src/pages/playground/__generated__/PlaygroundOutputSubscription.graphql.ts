/**
 * @generated SignedSource<<ba65ab9fe3de490faf7a710506a23cc8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, GraphQLSubscription } from 'relay-runtime';
export type ChatCompletionMessageRole = "AI" | "SYSTEM" | "TOOL" | "USER";
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "OPENAI";
export type TemplateLanguage = "F_STRING" | "MUSTACHE";
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
export type InvocationParameters = {
  maxCompletionTokens?: number | null;
  maxTokens?: number | null;
  seed?: number | null;
  stop?: ReadonlyArray<string> | null;
  temperature?: number | null;
  toolChoice?: any | null;
  topP?: number | null;
};
export type TemplateOptions = {
  language: TemplateLanguage;
  variables: any;
};
export type PlaygroundOutputSubscription$variables = {
  apiKey?: string | null;
  invocationParameters: InvocationParameters;
  messages: ReadonlyArray<ChatCompletionMessageInput>;
  model: GenerativeModelInput;
  templateOptions?: TemplateOptions | null;
  tools?: ReadonlyArray<any> | null;
};
export type PlaygroundOutputSubscription$data = {
  readonly chatCompletion: {
    readonly __typename: "ChatCompletionSubscriptionError";
    readonly message: string;
  } | {
    readonly __typename: "FinishedChatCompletion";
    readonly span: {
      readonly id: string;
    };
  } | {
    readonly __typename: "TextChunk";
    readonly content: string;
  } | {
    readonly __typename: "ToolCallChunk";
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
export type PlaygroundOutputSubscription = {
  response: PlaygroundOutputSubscription$data;
  variables: PlaygroundOutputSubscription$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "apiKey"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "invocationParameters"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "messages"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "model"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "templateOptions"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "tools"
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "apiKey",
            "variableName": "apiKey"
          },
          {
            "kind": "Variable",
            "name": "invocationParameters",
            "variableName": "invocationParameters"
          },
          {
            "kind": "Variable",
            "name": "messages",
            "variableName": "messages"
          },
          {
            "kind": "Variable",
            "name": "model",
            "variableName": "model"
          },
          {
            "kind": "Variable",
            "name": "template",
            "variableName": "templateOptions"
          },
          {
            "kind": "Variable",
            "name": "tools",
            "variableName": "tools"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
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
          (v6/*: any*/),
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
              (v6/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "type": "FinishedChatCompletion",
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/),
      (v4/*: any*/),
      (v5/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundOutputSubscription",
    "selections": (v7/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v3/*: any*/),
      (v1/*: any*/),
      (v5/*: any*/),
      (v4/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "PlaygroundOutputSubscription",
    "selections": (v7/*: any*/)
  },
  "params": {
    "cacheID": "96dec42dd14805e9b1adc1c112321064",
    "id": null,
    "metadata": {},
    "name": "PlaygroundOutputSubscription",
    "operationKind": "subscription",
    "text": "subscription PlaygroundOutputSubscription(\n  $messages: [ChatCompletionMessageInput!]!\n  $model: GenerativeModelInput!\n  $invocationParameters: InvocationParameters!\n  $tools: [JSON!]\n  $templateOptions: TemplateOptions\n  $apiKey: String\n) {\n  chatCompletion(input: {messages: $messages, model: $model, invocationParameters: $invocationParameters, tools: $tools, template: $templateOptions, apiKey: $apiKey}) {\n    __typename\n    ... on TextChunk {\n      content\n    }\n    ... on ToolCallChunk {\n      id\n      function {\n        name\n        arguments\n      }\n    }\n    ... on FinishedChatCompletion {\n      span {\n        id\n      }\n    }\n    ... on ChatCompletionSubscriptionError {\n      message\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c29d5c7acf3f5090b92480ce34101fa6";

export default node;
