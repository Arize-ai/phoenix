/**
 * @generated SignedSource<<dae3c9ba5b123f2232b0204fa174cfd0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SavePromptFormQuery$variables = Record<PropertyKey, never>;
export type SavePromptFormQuery$data = {
  readonly prompts: {
    readonly edges: ReadonlyArray<{
      readonly prompt: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type SavePromptFormQuery = {
  response: SavePromptFormQuery$data;
  variables: SavePromptFormQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Literal",
        "name": "first",
        "value": 200
      }
    ],
    "concreteType": "PromptConnection",
    "kind": "LinkedField",
    "name": "prompts",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "PromptEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": "prompt",
            "args": null,
            "concreteType": "Prompt",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": "prompts(first:200)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "SavePromptFormQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SavePromptFormQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "f58ec0bbc09a5d215619bb7bd5c9b2e2",
    "id": null,
    "metadata": {},
    "name": "SavePromptFormQuery",
    "operationKind": "query",
    "text": "query SavePromptFormQuery {\n  prompts(first: 200) {\n    edges {\n      prompt: node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f06c29d4c5318f96e838ba5f392cccf3";

export default node;
