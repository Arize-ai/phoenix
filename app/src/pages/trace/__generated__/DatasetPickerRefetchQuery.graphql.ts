/**
 * @generated SignedSource<<a1724e9a402cb5d04db3a67163b2ce2c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetPickerRefetchQuery$variables = Record<PropertyKey, never>;
export type DatasetPickerRefetchQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DatasetPicker__datasets">;
};
export type DatasetPickerRefetchQuery = {
  response: DatasetPickerRefetchQuery$data;
  variables: DatasetPickerRefetchQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetPickerRefetchQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DatasetPicker__datasets"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DatasetPickerRefetchQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetConnection",
        "kind": "LinkedField",
        "name": "datasets",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": "dataset",
                "args": null,
                "concreteType": "Dataset",
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
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "38a431d0ba6fa8c12622a1cbb3d1e446",
    "id": null,
    "metadata": {},
    "name": "DatasetPickerRefetchQuery",
    "operationKind": "query",
    "text": "query DatasetPickerRefetchQuery {\n  ...DatasetPicker__datasets\n}\n\nfragment DatasetPicker__datasets on Query {\n  datasets {\n    edges {\n      dataset: node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "03d88d1706089bb63edcd44d04563cbc";

export default node;
