/**
 * @generated SignedSource<<1ded4bd4e2ff50fcfe898beb9cef8283>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CreateDatasetInput = {
  description?: string | null;
  metadata?: any | null;
  name: string;
};
export type createDatasetToolMutation$variables = {
  input: CreateDatasetInput;
};
export type createDatasetToolMutation$data = {
  readonly createDataset: {
    readonly dataset: {
      readonly createdAt: string;
      readonly createdBy: {
        readonly profilePictureUrl: string | null;
        readonly username: string;
      } | null;
      readonly description: string | null;
      readonly evaluatorCount: number;
      readonly exampleCount: number;
      readonly experimentCount: number;
      readonly id: string;
      readonly labels: ReadonlyArray<{
        readonly color: string;
        readonly id: string;
        readonly name: string;
      }>;
      readonly metadata: any;
      readonly name: string;
      readonly splits: ReadonlyArray<{
        readonly color: string;
        readonly id: string;
        readonly name: string;
      }>;
      readonly updatedAt: string;
      readonly updatedBy: {
        readonly profilePictureUrl: string | null;
        readonly username: string;
      } | null;
      readonly " $fragmentSpreads": FragmentRefs<"DatasetSelect_dataset">;
    };
  };
};
export type createDatasetToolMutation = {
  response: createDatasetToolMutation$data;
  variables: createDatasetToolMutation$variables;
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
  "name": "createdAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v10 = [
  (v8/*:: as any*/),
  (v9/*:: as any*/)
],
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "exampleCount",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "experimentCount",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatorCount",
  "storageKey": null
},
v14 = [
  (v2/*:: as any*/),
  (v3/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "color",
    "storageKey": null
  }
],
v15 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetLabel",
  "kind": "LinkedField",
  "name": "labels",
  "plural": true,
  "selections": (v14/*:: as any*/),
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetSplit",
  "kind": "LinkedField",
  "name": "splits",
  "plural": true,
  "selections": (v14/*:: as any*/),
  "storageKey": null
},
v17 = [
  (v8/*:: as any*/),
  (v9/*:: as any*/),
  (v2/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "createDatasetToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DatasetMutationPayload",
        "kind": "LinkedField",
        "name": "createDataset",
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
              (v7/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "createdBy",
                "plural": false,
                "selections": (v10/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "updatedBy",
                "plural": false,
                "selections": (v10/*:: as any*/),
                "storageKey": null
              },
              (v11/*:: as any*/),
              (v12/*:: as any*/),
              (v13/*:: as any*/),
              (v15/*:: as any*/),
              (v16/*:: as any*/),
              {
                "kind": "InlineDataFragmentSpread",
                "name": "DatasetSelect_dataset",
                "selections": [
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  (v11/*:: as any*/),
                  (v15/*:: as any*/)
                ],
                "args": null,
                "argumentDefinitions": []
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
    "name": "createDatasetToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DatasetMutationPayload",
        "kind": "LinkedField",
        "name": "createDataset",
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
              (v7/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "createdBy",
                "plural": false,
                "selections": (v17/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "updatedBy",
                "plural": false,
                "selections": (v17/*:: as any*/),
                "storageKey": null
              },
              (v11/*:: as any*/),
              (v12/*:: as any*/),
              (v13/*:: as any*/),
              (v15/*:: as any*/),
              (v16/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "0c8d69ceee150428f6649e01bfa03a06",
    "id": null,
    "metadata": {},
    "name": "createDatasetToolMutation",
    "operationKind": "mutation",
    "text": "mutation createDatasetToolMutation(\n  $input: CreateDatasetInput!\n) {\n  createDataset(input: $input) {\n    dataset {\n      id\n      name\n      description\n      metadata\n      createdAt\n      updatedAt\n      createdBy {\n        username\n        profilePictureUrl\n        id\n      }\n      updatedBy {\n        username\n        profilePictureUrl\n        id\n      }\n      exampleCount\n      experimentCount\n      evaluatorCount\n      labels {\n        id\n        name\n        color\n      }\n      splits {\n        id\n        name\n        color\n      }\n      ...DatasetSelect_dataset\n    }\n  }\n}\n\nfragment DatasetSelect_dataset on Dataset {\n  id\n  name\n  exampleCount\n  labels {\n    id\n    name\n    color\n  }\n}\n"
  }
};
})();

(node as any).hash = "1f50b4f9ab433f43914500e6989e7930";

export default node;
