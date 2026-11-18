/**
 * @generated SignedSource<<4a0feab88dba465565c1ba05ae3e9bb7>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetLabelPickerDatasetQuery$variables = {
  datasetId: string;
};
export type DatasetLabelPickerDatasetQuery$data = {
  readonly dataset: {
    readonly labels?: ReadonlyArray<{
      readonly color: string;
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type DatasetLabelPickerDatasetQuery = {
  response: DatasetLabelPickerDatasetQuery$data;
  variables: DatasetLabelPickerDatasetQuery$variables;
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
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": [
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
    "name": "DatasetLabelPickerDatasetQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/)
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
    "name": "DatasetLabelPickerDatasetQuery",
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
          (v3/*:: as any*/),
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5da8f79c3dafddbe152d204ec7307a67",
    "id": null,
    "metadata": {},
    "name": "DatasetLabelPickerDatasetQuery",
    "operationKind": "query",
    "text": "query DatasetLabelPickerDatasetQuery(\n  $datasetId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      labels {\n        id\n        name\n        color\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "bc1e331619c1f153c37445b06dc9eb02";

export default node;
