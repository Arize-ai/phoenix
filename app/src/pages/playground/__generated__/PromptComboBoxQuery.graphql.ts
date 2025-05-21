/**
 * @generated SignedSource<<10d727f69671df06cc39c2f9e2c00ed0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PromptComboBoxQuery$variables = Record<PropertyKey, never>;
export type PromptComboBoxQuery$data = {
  readonly prompts: {
    readonly edges: ReadonlyArray<{
      readonly prompt: {
        readonly __typename: "Prompt";
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type PromptComboBoxQuery = {
  response: PromptComboBoxQuery$data;
  variables: PromptComboBoxQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Literal",
        "name": "first",
        "value": 100
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
                "name": "__typename",
                "storageKey": null
              },
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
    "storageKey": "prompts(first:100)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptComboBoxQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PromptComboBoxQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "ef34b1558ffaa8df1a26cad0bbbf6ca2",
    "id": null,
    "metadata": {},
    "name": "PromptComboBoxQuery",
    "operationKind": "query",
    "text": "query PromptComboBoxQuery {\n  prompts(first: 100) {\n    edges {\n      prompt: node {\n        __typename\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "cf962520b02c20fea5903113c8bac5cf";

export default node;
