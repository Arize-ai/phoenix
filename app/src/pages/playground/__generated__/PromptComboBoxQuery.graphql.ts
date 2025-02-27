/**
 * @generated SignedSource<<9dfcf51db4742a17a496feed7e3a8247>>
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
    "storageKey": null
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
    "cacheID": "72f4804265380881fdc62b5d8e66bb8b",
    "id": null,
    "metadata": {},
    "name": "PromptComboBoxQuery",
    "operationKind": "query",
    "text": "query PromptComboBoxQuery {\n  prompts {\n    edges {\n      prompt: node {\n        __typename\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1acc413e40da1ea527fb431f10b46cf2";

export default node;
