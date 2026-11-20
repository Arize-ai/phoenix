/**
 * @generated SignedSource<<5db5d36b5b8311f8a7b69e51daf803b1>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetLabelPickerQuery$variables = Record<PropertyKey, never>;
export type DatasetLabelPickerQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DatasetLabelPicker_allLabels">;
};
export type DatasetLabelPickerQuery = {
  response: DatasetLabelPickerQuery$data;
  variables: DatasetLabelPickerQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetLabelPickerQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DatasetLabelPicker_allLabels"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DatasetLabelPickerQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
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
                    "name": "color",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PageInfo",
            "kind": "LinkedField",
            "name": "pageInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endCursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "datasetLabels(first:100)"
      },
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "filters": null,
        "handle": "connection",
        "key": "DatasetLabelPicker_datasetLabels",
        "kind": "LinkedHandle",
        "name": "datasetLabels"
      }
    ]
  },
  "params": {
    "cacheID": "337b8ab0c631ccbdca16fe400df13036",
    "id": null,
    "metadata": {},
    "name": "DatasetLabelPickerQuery",
    "operationKind": "query",
    "text": "query DatasetLabelPickerQuery {\n  ...DatasetLabelPicker_allLabels\n}\n\nfragment DatasetLabelPicker_allLabels on Query {\n  datasetLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        color\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "474fd4a2cdbbfeeaa3c3fba059e5659e";

export default node;
