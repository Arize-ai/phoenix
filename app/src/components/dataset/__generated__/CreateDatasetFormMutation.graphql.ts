/**
 * @generated SignedSource<<86ba9c736e9305c4603f8126a0c93ffc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type CreateDatasetFormMutation$variables = {
  description?: string | null;
  metadata?: any | null;
  name: string;
};
export type CreateDatasetFormMutation$data = {
  readonly createDataset: {
    readonly dataset: {
      readonly createdAt: string;
      readonly description: string | null;
      readonly exampleCount: number;
      readonly experimentCount: number;
      readonly id: string;
      readonly metadata: any;
      readonly name: string;
    };
  };
};
export type CreateDatasetFormMutation = {
  response: CreateDatasetFormMutation$data;
  variables: CreateDatasetFormMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "metadata"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
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
            "name": "description",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "metadata",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "createdAt",
            "storageKey": null
          },
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
            "kind": "ScalarField",
            "name": "experimentCount",
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateDatasetFormMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "CreateDatasetFormMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "6aa615e27e1ccaa5431ba481842b43d0",
    "id": null,
    "metadata": {},
    "name": "CreateDatasetFormMutation",
    "operationKind": "mutation",
    "text": "mutation CreateDatasetFormMutation(\n  $name: String!\n  $description: String = null\n  $metadata: JSON = null\n) {\n  createDataset(input: {name: $name, description: $description, metadata: $metadata}) {\n    dataset {\n      id\n      name\n      description\n      metadata\n      createdAt\n      exampleCount\n      experimentCount\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5921369d33cc0fb1dffb5d943469a378";

export default node;
