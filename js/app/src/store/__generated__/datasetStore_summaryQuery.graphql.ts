/**
 * @generated SignedSource<<ff9f8d9b13166ed184945a43b645c26f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type datasetStore_summaryQuery$variables = {
  datasetId: string;
};
export type datasetStore_summaryQuery$data = {
  readonly dataset: {
    readonly exampleCount?: number;
    readonly id: string;
    readonly labels?: ReadonlyArray<{
      readonly color: string;
      readonly id: string;
      readonly name: string;
    }>;
    readonly splits?: ReadonlyArray<{
      readonly color: string;
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type datasetStore_summaryQuery = {
  response: datasetStore_summaryQuery$data;
  variables: datasetStore_summaryQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  (v2/*:: as any*/),
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
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "exampleCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": (v3/*:: as any*/),
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetSplit",
      "kind": "LinkedField",
      "name": "splits",
      "plural": true,
      "selections": (v3/*:: as any*/),
      "storageKey": null
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "datasetStore_summaryQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "datasetStore_summaryQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v2/*:: as any*/),
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ad7b57f1d7ed279896c3e411ec600351",
    "id": null,
    "metadata": {},
    "name": "datasetStore_summaryQuery",
    "operationKind": "query",
    "text": "query datasetStore_summaryQuery(\n  $datasetId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      exampleCount\n      labels {\n        id\n        name\n        color\n      }\n      splits {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "834b417eadd238ee62bb783b487036ab";

export default node;
