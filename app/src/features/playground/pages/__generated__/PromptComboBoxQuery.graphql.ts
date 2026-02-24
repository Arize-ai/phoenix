/**
 * @generated SignedSource<<3c330f0c00d01a6bbc8139e223557436>>
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
    "storageKey": "prompts(first:200)"
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
    "cacheID": "8dddcd4c6c884248b53dbaf0a625c335",
    "id": null,
    "metadata": {},
    "name": "PromptComboBoxQuery",
    "operationKind": "query",
    "text": "query PromptComboBoxQuery {\n  prompts(first: 200) {\n    edges {\n      prompt: node {\n        __typename\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "42af63a75d1f1b2184518e94395121cd";

export default node;
