/**
 * @generated SignedSource<<88053bc533e6869deed45934e20d8300>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteDatasetInput = {
  datasetId: string;
};
export type deleteDatasetToolMutation$variables = {
  input: DeleteDatasetInput;
};
export type deleteDatasetToolMutation$data = {
  readonly deleteDataset: {
    readonly dataset: {
      readonly id: string;
      readonly name: string;
    };
  };
};
export type deleteDatasetToolMutation = {
  response: deleteDatasetToolMutation$data;
  variables: deleteDatasetToolMutation$variables;
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
    "name": "deleteDataset",
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
    "name": "deleteDatasetToolMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "deleteDatasetToolMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "620162713f2bb0393bff264f1af62456",
    "id": null,
    "metadata": {},
    "name": "deleteDatasetToolMutation",
    "operationKind": "mutation",
    "text": "mutation deleteDatasetToolMutation(\n  $input: DeleteDatasetInput!\n) {\n  deleteDataset(input: $input) {\n    dataset {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c2516298eee08ae32989d2ba79a1ad6b";

export default node;
