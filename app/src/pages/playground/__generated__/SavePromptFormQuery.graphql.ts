/**
 * @generated SignedSource<<3137f8fe8ac50457a669ea419555654d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
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
    "args": null,
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
    "storageKey": null
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
    "cacheID": "654725a48bf8fb568b8e05fd37696920",
    "id": null,
    "metadata": {},
    "name": "SavePromptFormQuery",
    "operationKind": "query",
    "text": "query SavePromptFormQuery {\n  prompts {\n    edges {\n      prompt: node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a9d184ea6bad7c7ff3b15460ce72b9fd";

export default node;
