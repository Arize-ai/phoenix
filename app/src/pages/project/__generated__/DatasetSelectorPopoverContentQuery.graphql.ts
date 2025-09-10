/**
 * @generated SignedSource<<a5fdba71030cc6f6b8f43088da65e5a2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
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
        "args": [
          {
            "kind": "Literal",
            "name": "search",
            "value": ""
          }
        ],
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
        "args": [
          {
            "fields": [
              {
                "kind": "Literal",
                "name": "col",
                "value": "name"
              },
              {
                "kind": "Literal",
                "name": "value",
                "value": ""
              }
            ],
            "kind": "ObjectValue",
            "name": "filter"
          }
        ],
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
        "storageKey": "datasets(filter:{\"col\":\"name\",\"value\":\"\"})"
      }
    ]
  },
  "params": {
    "cacheID": "02fcced29ddf37dbf2220d4d94ec7a44",
    "id": null,
    "metadata": {},
    "name": "DatasetSelectorPopoverContentQuery",
    "operationKind": "query",
    "text": "query DatasetSelectorPopoverContentQuery {\n  ...DatasetSelectorPopoverContent_datasets_1oCkZB\n}\n\nfragment DatasetSelectorPopoverContent_datasets_1oCkZB on Query {\n  datasets(filter: {col: name, value: \"\"}) {\n    edges {\n      dataset: node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "ed6b4586cff4c203c56ae2f5f5ce6a8e";

export default node;
