/**
 * @generated SignedSource<<b9d954ca545430a4fcfda1fe3da42f86>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetLabelPickerSetLabelsMutation$variables = {
  datasetId: string;
  datasetLabelIds: ReadonlyArray<string>;
};
export type DatasetLabelPickerSetLabelsMutation$data = {
  readonly setDatasetLabels: {
    readonly dataset: {
      readonly id: string;
      readonly labels: ReadonlyArray<{
        readonly color: string;
        readonly id: string;
        readonly name: string;
      }>;
    };
  };
};
export type DatasetLabelPickerSetLabelsMutation = {
  response: DatasetLabelPickerSetLabelsMutation$data;
  variables: DatasetLabelPickerSetLabelsMutation$variables;
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
    "name": "datasetLabelIds"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "datasetId",
            "variableName": "datasetId"
          },
          {
            "kind": "Variable",
            "name": "datasetLabelIds",
            "variableName": "datasetLabelIds"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "SetDatasetLabelsMutationPayload",
    "kind": "LinkedField",
    "name": "setDatasetLabels",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Dataset",
        "kind": "LinkedField",
        "name": "dataset",
        "plural": false,
        "selections": [
          (v1/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetLabel",
            "kind": "LinkedField",
            "name": "labels",
            "plural": true,
            "selections": [
              (v1/*:: as any*/),
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
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetLabelPickerSetLabelsMutation",
    "selections": (v2/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DatasetLabelPickerSetLabelsMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "533b216a64a84750ff4e2b9bd01cdd7e",
    "id": null,
    "metadata": {},
    "name": "DatasetLabelPickerSetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation DatasetLabelPickerSetLabelsMutation(\n  $datasetId: ID!\n  $datasetLabelIds: [ID!]!\n) {\n  setDatasetLabels(input: {datasetId: $datasetId, datasetLabelIds: $datasetLabelIds}) {\n    dataset {\n      id\n      labels {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d38b09beb7d7303e5bd563f02ad0a235";

export default node;
