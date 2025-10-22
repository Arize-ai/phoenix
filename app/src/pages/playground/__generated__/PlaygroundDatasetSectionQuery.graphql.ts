/**
 * @generated SignedSource<<cd800de47524c191e32b7e5b7c942512>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PlaygroundDatasetSectionQuery$variables = {
  datasetId: string;
  splitIds?: ReadonlyArray<string> | null;
};
export type PlaygroundDatasetSectionQuery$data = {
  readonly dataset: {
    readonly exampleCount?: number;
    readonly name?: string;
    readonly splits?: ReadonlyArray<{
      readonly color: string;
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type PlaygroundDatasetSectionQuery = {
  response: PlaygroundDatasetSectionQuery$data;
  variables: PlaygroundDatasetSectionQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "splitIds"
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
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "kind": "InlineFragment",
  "selections": [
    (v2/*: any*/),
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "splitIds",
          "variableName": "splitIds"
        }
      ],
      "kind": "ScalarField",
      "name": "exampleCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetSplit",
      "kind": "LinkedField",
      "name": "splits",
      "plural": true,
      "selections": [
        (v3/*: any*/),
        (v2/*: any*/),
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
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundDatasetSectionQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundDatasetSectionQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
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
          (v4/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "670c0929ea8326b523cba2dab6376491",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetSectionQuery",
    "operationKind": "query",
    "text": "query PlaygroundDatasetSectionQuery(\n  $datasetId: ID!\n  $splitIds: [ID!]\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      name\n      exampleCount(splitIds: $splitIds)\n      splits {\n        id\n        name\n        color\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f0173204aa67dfb32b3c80c628a75501";

export default node;
