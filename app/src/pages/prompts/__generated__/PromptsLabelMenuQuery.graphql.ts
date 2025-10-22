/**
 * @generated SignedSource<<01d48bf23b5d1156ff5c9e0528527577>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PromptsLabelMenuQuery$variables = Record<PropertyKey, never>;
export type PromptsLabelMenuQuery$data = {
  readonly promptLabels: {
    readonly edges: ReadonlyArray<{
      readonly label: {
        readonly color: string;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type PromptsLabelMenuQuery = {
  response: PromptsLabelMenuQuery$data;
  variables: PromptsLabelMenuQuery$variables;
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
    "concreteType": "PromptLabelConnection",
    "kind": "LinkedField",
    "name": "promptLabels",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "PromptLabelEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": "label",
            "args": null,
            "concreteType": "PromptLabel",
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
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "color",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": "promptLabels(first:100)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptsLabelMenuQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PromptsLabelMenuQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "b1eec4579aec591910252fa2619f47f4",
    "id": null,
    "metadata": {},
    "name": "PromptsLabelMenuQuery",
    "operationKind": "query",
    "text": "query PromptsLabelMenuQuery {\n  promptLabels(first: 100) {\n    edges {\n      label: node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8874d1dc96531174072149aea94605a1";

export default node;
