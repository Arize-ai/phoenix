/**
 * @generated SignedSource<<d69ae4e1c5c48f6560049b72d46e6da9>>
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
  connections: ReadonlyArray<string>;
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
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v11 = [
  (v9/*:: as any*/),
  (v10/*:: as any*/)
],
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "exampleCount",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "experimentCount",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatorCount",
  "storageKey": null
},
v15 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "color",
    "storageKey": null
  }
],
v16 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetLabel",
  "kind": "LinkedField",
  "name": "labels",
  "plural": true,
  "selections": (v15/*:: as any*/),
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetSplit",
  "kind": "LinkedField",
  "name": "splits",
  "plural": true,
  "selections": (v15/*:: as any*/),
  "storageKey": null
},
v18 = [
  (v9/*:: as any*/),
  (v10/*:: as any*/),
  (v3/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "createDatasetToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
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
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "createdBy",
                "plural": false,
                "selections": (v11/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "updatedBy",
                "plural": false,
                "selections": (v11/*:: as any*/),
                "storageKey": null
              },
              (v12/*:: as any*/),
              (v13/*:: as any*/),
              (v14/*:: as any*/),
              (v16/*:: as any*/),
              (v17/*:: as any*/),
              {
                "kind": "InlineDataFragmentSpread",
                "name": "DatasetSelect_dataset",
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v12/*:: as any*/),
                  (v16/*:: as any*/)
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
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "createDatasetToolMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
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
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v7/*:: as any*/),
              (v8/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "createdBy",
                "plural": false,
                "selections": (v18/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "updatedBy",
                "plural": false,
                "selections": (v18/*:: as any*/),
                "storageKey": null
              },
              (v12/*:: as any*/),
              (v13/*:: as any*/),
              (v14/*:: as any*/),
              (v16/*:: as any*/),
              (v17/*:: as any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "appendNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "dataset",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "DatasetEdge"
              }
            ]
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

(node as any).hash = "6f076e29e8139a5a2fbb73167f1c30aa";

export default node;
