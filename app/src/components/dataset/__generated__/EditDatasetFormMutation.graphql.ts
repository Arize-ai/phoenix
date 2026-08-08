/**
 * @generated SignedSource<<ec654dbb510a4a02c2c0f1e8c3660c7f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EditDatasetFormMutation$variables = {
  datasetId: string;
  description?: string | null;
  metadata?: any | null;
  name: string;
};
export type EditDatasetFormMutation$data = {
  readonly patchDataset: {
    readonly dataset: {
      readonly description: string | null;
      readonly metadata: any;
      readonly name: string;
    };
  };
};
export type EditDatasetFormMutation = {
  response: EditDatasetFormMutation$data;
  variables: EditDatasetFormMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "metadata"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v4 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "datasetId",
        "variableName": "datasetId"
      },
      {
        "kind": "Variable",
        "name": "description",
        "variableName": "description"
      },
      {
        "kind": "Variable",
        "name": "metadata",
        "variableName": "metadata"
      },
      {
        "kind": "Variable",
        "name": "name",
        "variableName": "name"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditDatasetFormMutation",
    "selections": [
      {
        "alias": null,
        "args": (v4/*:: as any*/),
        "concreteType": "DatasetMutationPayload",
        "kind": "LinkedField",
        "name": "patchDataset",
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
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v3/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EditDatasetFormMutation",
    "selections": [
      {
        "alias": null,
        "args": (v4/*:: as any*/),
        "concreteType": "DatasetMutationPayload",
        "kind": "LinkedField",
        "name": "patchDataset",
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
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
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
    "cacheID": "24675cd487da4f57f6aa04d850e65ad3",
    "id": null,
    "metadata": {},
    "name": "EditDatasetFormMutation",
    "operationKind": "mutation",
    "text": "mutation EditDatasetFormMutation(\n  $datasetId: ID!\n  $name: String!\n  $description: String = null\n  $metadata: JSON = null\n) {\n  patchDataset(input: {datasetId: $datasetId, name: $name, description: $description, metadata: $metadata}) {\n    dataset {\n      name\n      description\n      metadata\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e952d9cbc840dd6cd447b3024178aab4";

export default node;
