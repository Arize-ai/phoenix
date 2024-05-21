/**
 * @generated SignedSource<<fed518c0b30d6d9dac45653f93c43a63>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetSelectorPopoverContentQuery$variables = Record<PropertyKey, never>;
export type DatasetSelectorPopoverContentQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DatasetSelectorPopoverContent_datasets">;
};
export type DatasetSelectorPopoverContentQuery = {
  response: DatasetSelectorPopoverContentQuery$data;
  variables: DatasetSelectorPopoverContentQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetSelectorPopoverContentQuery",
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
    "name": "DatasetSelectorPopoverContentQuery",
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
    "cacheID": "5fb28a402f330dd235295da21efea58b",
    "id": null,
    "metadata": {},
    "name": "DatasetSelectorPopoverContentQuery",
    "operationKind": "query",
    "text": "query DatasetSelectorPopoverContentQuery {\n  ...DatasetSelectorPopoverContent_datasets\n}\n\nfragment DatasetSelectorPopoverContent_datasets on Query {\n  datasets {\n    edges {\n      dataset: node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "7cd8a13144d97d2b5294f2a09c9e1351";

export default node;
