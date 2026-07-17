/**
 * @generated SignedSource<<78f21802be0f7498872e8120f2e40f25>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type promptVersionsLoaderQuery$variables = {
  id: string;
};
export type promptVersionsLoaderQuery$data = {
  readonly prompt: {
    readonly promptVersions?: {
      readonly edges: ReadonlyArray<{
        readonly promptVersion: {
          readonly id: string;
        };
      }>;
    };
  };
};
export type promptVersionsLoaderQuery = {
  response: promptVersionsLoaderQuery$data;
  variables: promptVersionsLoaderQuery$variables;
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 1
        }
      ],
      "concreteType": "PromptVersionConnection",
      "kind": "LinkedField",
      "name": "promptVersions",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptVersionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "promptVersion",
              "args": null,
              "concreteType": "PromptVersion",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v2/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "promptVersions(first:1)"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "promptVersionsLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "promptVersionsLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
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
          (v3/*:: as any*/),
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "72451f81ebdef0195b7338c67ae5f327",
    "id": null,
    "metadata": {},
    "name": "promptVersionsLoaderQuery",
    "operationKind": "query",
    "text": "query promptVersionsLoaderQuery(\n  $id: ID!\n) {\n  prompt: node(id: $id) {\n    __typename\n    ... on Prompt {\n      promptVersions(first: 1) {\n        edges {\n          promptVersion: node {\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "82115f75fbd5968bbe774fb7e006718f";

export default node;
