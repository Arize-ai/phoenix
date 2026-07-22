/**
 * @generated SignedSource<<1240c41d78064e5758343e3d97d97553>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type listDatasetExamplesToolSplitsQuery$variables = {
  datasetId: string;
};
export type listDatasetExamplesToolSplitsQuery$data = {
  readonly dataset: {
    readonly __typename: "Dataset";
    readonly splits: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type listDatasetExamplesToolSplitsQuery = {
  response: listDatasetExamplesToolSplitsQuery$data;
  variables: listDatasetExamplesToolSplitsQuery$variables;
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
  "name": "__typename",
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
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetSplit",
      "kind": "LinkedField",
      "name": "splits",
      "plural": true,
      "selections": [
        (v3/*:: as any*/),
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
  "type": "Dataset",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "listDatasetExamplesToolSplitsQuery",
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
    "name": "listDatasetExamplesToolSplitsQuery",
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
          (v4/*:: as any*/),
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "56b3f30db1fa2afc1be3b53919849eac",
    "id": null,
    "metadata": {},
    "name": "listDatasetExamplesToolSplitsQuery",
    "operationKind": "query",
    "text": "query listDatasetExamplesToolSplitsQuery(\n  $datasetId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      splits {\n        id\n        name\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "3c7ffc25f0ffd3de0d906ab95907bc6d";

export default node;
