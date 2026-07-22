/**
 * @generated SignedSource<<07f16e03e849bb2ff33f421013f3329d>>
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
      readonly id: string;
      readonly name: string;
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
    "name": "patchDatasetToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "patchDatasetToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "98c0fb2a2ab9548707c6b75ac6fa7b2a",
    "id": null,
    "metadata": {},
    "name": "patchDatasetToolMutation",
    "operationKind": "mutation",
    "text": "mutation patchDatasetToolMutation(\n  $input: PatchDatasetInput!\n) {\n  patchDataset(input: $input) {\n    dataset {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "abba55d52b1382f617b7f1291fa19d2d";

export default node;
