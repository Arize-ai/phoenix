/**
 * @generated SignedSource<<b370e5f9d178faa31d2697ea77db3830>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionsLabelMenuQuery$variables = Record<PropertyKey, never>;
export type DecisionsLabelMenuQuery$data = {
  readonly decisionLabels: {
    readonly edges: ReadonlyArray<{
      readonly label: {
        readonly color: string | null;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type DecisionsLabelMenuQuery = {
  response: DecisionsLabelMenuQuery$data;
  variables: DecisionsLabelMenuQuery$variables;
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
    "concreteType": "DecisionLabelConnection",
    "kind": "LinkedField",
    "name": "decisionLabels",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DecisionLabelEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": "label",
            "args": null,
            "concreteType": "DecisionLabel",
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
    "storageKey": "decisionLabels(first:100)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionsLabelMenuQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DecisionsLabelMenuQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "fe541e766b9d5d1164d245d6e0351634",
    "id": null,
    "metadata": {},
    "name": "DecisionsLabelMenuQuery",
    "operationKind": "query",
    "text": "query DecisionsLabelMenuQuery {\n  decisionLabels(first: 100) {\n    edges {\n      label: node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "78a6b372e2742371de55507c845c992e";

export default node;
