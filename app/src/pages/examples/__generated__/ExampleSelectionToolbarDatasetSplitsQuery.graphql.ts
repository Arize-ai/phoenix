/**
 * @generated SignedSource<<c4f7a543900f603f390191be7c4be92c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExampleSelectionToolbarDatasetSplitsQuery$variables = Record<PropertyKey, never>;
export type ExampleSelectionToolbarDatasetSplitsQuery$data = {
  readonly datasetSplits: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type ExampleSelectionToolbarDatasetSplitsQuery = {
  response: ExampleSelectionToolbarDatasetSplitsQuery$data;
  variables: ExampleSelectionToolbarDatasetSplitsQuery$variables;
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
    "concreteType": "DatasetSplitConnection",
    "kind": "LinkedField",
    "name": "datasetSplits",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetSplitEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetSplit",
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
    "storageKey": "datasetSplits(first:200)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExampleSelectionToolbarDatasetSplitsQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ExampleSelectionToolbarDatasetSplitsQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "3aa53b0d266dfb46ee110c927650cbb8",
    "id": null,
    "metadata": {},
    "name": "ExampleSelectionToolbarDatasetSplitsQuery",
    "operationKind": "query",
    "text": "query ExampleSelectionToolbarDatasetSplitsQuery {\n  datasetSplits(first: 200) {\n    edges {\n      node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0f0d7a7ff9c0f0ea946e4acd68eaeeb2";

export default node;
