/**
 * @generated SignedSource<<0c4cf53dd4a0183ff8d2eb436d18b2f9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetSelectorPopoverContentDatasetsQuery$variables = Record<PropertyKey, never>;
export type DatasetSelectorPopoverContentDatasetsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DatasetSelectorPopoverContent_datasets">;
};
export type DatasetSelectorPopoverContentDatasetsQuery = {
  response: DatasetSelectorPopoverContentDatasetsQuery$data;
  variables: DatasetSelectorPopoverContentDatasetsQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetSelectorPopoverContentDatasetsQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DatasetSelectorPopoverContent_datasets"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DatasetSelectorPopoverContentDatasetsQuery",
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
    "cacheID": "6d459b61a36b99979f025742892941f9",
    "id": null,
    "metadata": {},
    "name": "DatasetSelectorPopoverContentDatasetsQuery",
    "operationKind": "query",
    "text": "query DatasetSelectorPopoverContentDatasetsQuery {\n  ...DatasetSelectorPopoverContent_datasets\n}\n\nfragment DatasetSelectorPopoverContent_datasets on Query {\n  datasets {\n    edges {\n      dataset: node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "40d5267ad0ec2335a73ff2a4d05bbed1";

export default node;
