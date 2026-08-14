/**
 * @generated SignedSource<<f11ba9773ed5b389e991f449228342cd>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type listLabelsToolByNamesQuery$variables = {
  first: number;
  names: ReadonlyArray<string>;
};
export type listLabelsToolByNamesQuery$data = {
  readonly datasetLabels: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly color: string;
        readonly description: string | null;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type listLabelsToolByNamesQuery = {
  response: listLabelsToolByNamesQuery$data;
  variables: listLabelsToolByNamesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "names"
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "first",
        "variableName": "first"
      },
      {
        "kind": "Variable",
        "name": "names",
        "variableName": "names"
      }
    ],
    "concreteType": "DatasetLabelConnection",
    "kind": "LinkedField",
    "name": "datasetLabels",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetLabelEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetLabel",
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
                "name": "description",
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
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "listLabelsToolByNamesQuery",
    "selections": (v2/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "listLabelsToolByNamesQuery",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "2fb3d6af6f02a745e6b8b87a0aa7c69a",
    "id": null,
    "metadata": {},
    "name": "listLabelsToolByNamesQuery",
    "operationKind": "query",
    "text": "query listLabelsToolByNamesQuery(\n  $names: [String!]!\n  $first: Int!\n) {\n  datasetLabels(names: $names, first: $first) {\n    edges {\n      node {\n        id\n        name\n        description\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "04989a91045d2d51b1342c0cf1a9368e";

export default node;
