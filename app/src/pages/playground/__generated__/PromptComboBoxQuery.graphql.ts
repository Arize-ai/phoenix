/**
 * @generated SignedSource<<d47903134359995e918ddac31b19387d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type PromptComboBoxQuery$variables = {
  first?: number | null;
};
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
    "defaultValue": 100,
    "kind": "LocalArgument",
    "name": "first"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "first",
        "variableName": "first"
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
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptComboBoxQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PromptComboBoxQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ffacaa27e41821aa3af1b8de8e1b4dc3",
    "id": null,
    "metadata": {},
    "name": "PromptComboBoxQuery",
    "operationKind": "query",
    "text": "query PromptComboBoxQuery(\n  $first: Int = 100\n) {\n  prompts(first: $first) {\n    edges {\n      prompt: node {\n        __typename\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7c2752fa4e372fc9b89638eb208d64f2";

export default node;
