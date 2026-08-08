/**
 * @generated SignedSource<<71ab9c6153d5f5a728bb595f92a4b768>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
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
      readonly id: string;
      readonly name: string;
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
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
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
    "name": "createDatasetToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "createDatasetToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "5c6093cefe5cc9c7afa5922d2142907c",
    "id": null,
    "metadata": {},
    "name": "createDatasetToolMutation",
    "operationKind": "mutation",
    "text": "mutation createDatasetToolMutation(\n  $input: CreateDatasetInput!\n) {\n  createDataset(input: $input) {\n    dataset {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "947383c1b6c9b8d29b03b20a983a8311";

export default node;
