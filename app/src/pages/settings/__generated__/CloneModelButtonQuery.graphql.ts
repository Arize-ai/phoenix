/**
 * @generated SignedSource<<4d01ad78d03e43db31ef54d646e733b0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "XAI";
export type CloneModelButtonQuery$variables = {
  id: string;
};
export type CloneModelButtonQuery$data = {
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
export type CloneModelButtonQuery = {
  response: CloneModelButtonQuery$data;
  variables: CloneModelButtonQuery$variables;
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
    "name": "CloneModelButtonQuery",
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
    "name": "CloneModelButtonQuery",
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
    "cacheID": "059ccf96a0f838c8b2311925cbae1c70",
    "id": null,
    "metadata": {},
    "name": "CloneModelButtonQuery",
    "operationKind": "query",
    "text": "query CloneModelButtonQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Model {\n      id\n      name\n      provider\n      namePattern\n      providerKey\n      tokenCost {\n        input\n        output\n        cacheRead\n        cacheWrite\n        promptAudio\n        completionAudio\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "b44d8a0c682a7f2e0bf275a6262f2e9c";

export default node;
