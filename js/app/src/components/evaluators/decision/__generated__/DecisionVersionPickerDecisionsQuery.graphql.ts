/**
 * @generated SignedSource<<b278d13f66fd595a803541938f741bca>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionVersionPickerDecisionsQuery$variables = Record<PropertyKey, never>;
export type DecisionVersionPickerDecisionsQuery$data = {
  readonly decisions: {
    readonly edges: ReadonlyArray<{
      readonly decision: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type DecisionVersionPickerDecisionsQuery = {
  response: DecisionVersionPickerDecisionsQuery$data;
  variables: DecisionVersionPickerDecisionsQuery$variables;
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
    "concreteType": "DecisionConnection",
    "kind": "LinkedField",
    "name": "decisions",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DecisionEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": "decision",
            "args": null,
            "concreteType": "Decision",
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
    "storageKey": "decisions(first:200)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionVersionPickerDecisionsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DecisionVersionPickerDecisionsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "622bf474acd5edabbfe62bd2b4e27f9a",
    "id": null,
    "metadata": {},
    "name": "DecisionVersionPickerDecisionsQuery",
    "operationKind": "query",
    "text": "query DecisionVersionPickerDecisionsQuery {\n  decisions(first: 200) {\n    edges {\n      decision: node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b11a4b444c33915699fd7dba03d18a81";

export default node;
