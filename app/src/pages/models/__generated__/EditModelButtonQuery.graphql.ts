/**
 * @generated SignedSource<<a0473bc591aa67b7053a10dac9371254>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type EditModelButtonQuery$variables = {
  id: string;
};
export type EditModelButtonQuery$data = {
  readonly node: {
    readonly id?: string;
    readonly name?: string;
    readonly namePattern?: string;
    readonly provider?: string | null;
    readonly providerKey?: GenerativeProviderKey | null;
    readonly tokenCost?: {
      readonly cacheRead: number | null;
      readonly cacheWrite: number | null;
      readonly completionAudio: number | null;
      readonly input: number | null;
      readonly output: number | null;
      readonly promptAudio: number | null;
    } | null;
  };
};
export type EditModelButtonQuery = {
  response: EditModelButtonQuery$data;
  variables: EditModelButtonQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
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
  "name": "provider",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "namePattern",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "providerKey",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "TokenCost",
  "kind": "LinkedField",
  "name": "tokenCost",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "input",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "output",
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "promptAudio",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "completionAudio",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditModelButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/)
            ],
            "type": "Model",
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
    "name": "EditModelButtonQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/)
            ],
            "type": "Model",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "54660f6e6faa58e9c892e44faf02c052",
    "id": null,
    "metadata": {},
    "name": "EditModelButtonQuery",
    "operationKind": "query",
    "text": "query EditModelButtonQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Model {\n      id\n      name\n      provider\n      namePattern\n      providerKey\n      tokenCost {\n        input\n        output\n        cacheRead\n        cacheWrite\n        promptAudio\n        completionAudio\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "87ff065b0579d9d3d4b11f8392d454c5";

export default node;
