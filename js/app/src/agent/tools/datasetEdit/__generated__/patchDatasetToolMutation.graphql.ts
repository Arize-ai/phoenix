/**
 * @generated SignedSource<<b8752afb3a960e78cee6552cb586c4e8>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PatchDatasetInput = {
  datasetId: string;
  description?: string | null;
  metadata?: any | null;
  name?: string | null;
};
export type patchDatasetToolMutation$variables = {
  input: PatchDatasetInput;
};
export type patchDatasetToolMutation$data = {
  readonly patchDataset: {
    readonly dataset: {
      readonly description: string | null;
      readonly id: string;
      readonly metadata: any;
      readonly name: string;
      readonly updatedAt: string;
      readonly updatedBy: {
        readonly profilePictureUrl: string | null;
        readonly username: string;
      } | null;
    };
  };
};
export type patchDatasetToolMutation = {
  response: patchDatasetToolMutation$data;
  variables: patchDatasetToolMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "patchDatasetToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "updatedBy",
                "plural": false,
                "selections": [
                  (v7/*:: as any*/),
                  (v8/*:: as any*/)
                ],
                "storageKey": null
              }
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "patchDatasetToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "updatedBy",
                "plural": false,
                "selections": [
                  (v7/*:: as any*/),
                  (v8/*:: as any*/),
                  (v2/*:: as any*/)
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
    "cacheID": "fff43412777d6c2d1e1cfe175d99d1c1",
    "id": null,
    "metadata": {},
    "name": "patchDatasetToolMutation",
    "operationKind": "mutation",
    "text": "mutation patchDatasetToolMutation(\n  $input: PatchDatasetInput!\n) {\n  patchDataset(input: $input) {\n    dataset {\n      id\n      name\n      description\n      metadata\n      updatedAt\n      updatedBy {\n        username\n        profilePictureUrl\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e24641e0ad7bb59883f0c7e85f72ffa5";

export default node;
