/**
 * @generated SignedSource<<795b9e0fde3350499e6280e6f4ce4b0e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SpanTokenCount_TokenDetailsQuery$variables = {
  nodeId: string;
};
export type SpanTokenCount_TokenDetailsQuery$data = {
  readonly node: {
    readonly __typename: "ProjectSession";
    readonly tokenUsage: {
      readonly completion: number;
      readonly prompt: number;
    };
  } | {
    readonly __typename: "Span";
    readonly tokenCountCompletion: number | null;
    readonly tokenCountPrompt: number | null;
    readonly tokenPromptDetails: {
      readonly audio: number | null;
      readonly cacheRead: number | null;
      readonly cacheWrite: number | null;
    };
  } | {
    readonly __typename: "Trace";
    readonly rootSpan: {
      readonly cumulativeTokenCountCompletion: number | null;
      readonly cumulativeTokenCountPrompt: number | null;
    } | null;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type SpanTokenCount_TokenDetailsQuery = {
  response: SpanTokenCount_TokenDetailsQuery$data;
  variables: SpanTokenCount_TokenDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "nodeId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "nodeId"
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
  "kind": "InlineFragment",
  "selections": [
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
      "name": "tokenCountCompletion",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "TokenCountPromptDetails",
      "kind": "LinkedField",
      "name": "tokenPromptDetails",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "audio",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cacheRead",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "cacheWrite",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
},
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "TokenUsage",
      "kind": "LinkedField",
      "name": "tokenUsage",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "prompt",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "completion",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectSession",
  "abstractKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cumulativeTokenCountPrompt",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cumulativeTokenCountCompletion",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanTokenCount_TokenDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "rootSpan",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v6/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Trace",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SpanTokenCount_TokenDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Span",
                "kind": "LinkedField",
                "name": "rootSpan",
                "plural": false,
                "selections": [
                  (v5/*: any*/),
                  (v6/*: any*/),
                  (v7/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Trace",
            "abstractKey": null
          },
          (v7/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "60d806b4424ef2a5672ceeb892e097e6",
    "id": null,
    "metadata": {},
    "name": "SpanTokenCount_TokenDetailsQuery",
    "operationKind": "query",
    "text": "query SpanTokenCount_TokenDetailsQuery(\n  $nodeId: ID!\n) {\n  node(id: $nodeId) {\n    __typename\n    ... on Span {\n      tokenCountPrompt\n      tokenCountCompletion\n      tokenPromptDetails {\n        audio\n        cacheRead\n        cacheWrite\n      }\n    }\n    ... on ProjectSession {\n      tokenUsage {\n        prompt\n        completion\n      }\n    }\n    ... on Trace {\n      rootSpan {\n        cumulativeTokenCountPrompt\n        cumulativeTokenCountCompletion\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f7d2bdeb3efc856fb1883e7337bc225f";

export default node;
