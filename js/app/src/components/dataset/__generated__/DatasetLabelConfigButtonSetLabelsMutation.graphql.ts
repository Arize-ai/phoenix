/**
 * @generated SignedSource<<df725d78f079632848e2b6969d98c83e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetLabelConfigButtonSetLabelsMutation$variables = {
  datasetId: string;
  datasetLabelIds: ReadonlyArray<string>;
};
export type DatasetLabelConfigButtonSetLabelsMutation$data = {
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
export type DatasetLabelConfigButtonSetLabelsMutation = {
  response: DatasetLabelConfigButtonSetLabelsMutation$data;
  variables: DatasetLabelConfigButtonSetLabelsMutation$variables;
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
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
    "selections": (v2/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "2578453afc9307312ce6d800e272e7fd",
    "id": null,
    "metadata": {},
    "name": "DatasetLabelConfigButtonSetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation DatasetLabelConfigButtonSetLabelsMutation(\n  $datasetId: ID!\n  $datasetLabelIds: [ID!]!\n) {\n  setDatasetLabels(input: {datasetId: $datasetId, datasetLabelIds: $datasetLabelIds}) {\n    dataset {\n      id\n      labels {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c3b75ee3be0ec65cbebd4a7b7a9b770c";

export default node;
