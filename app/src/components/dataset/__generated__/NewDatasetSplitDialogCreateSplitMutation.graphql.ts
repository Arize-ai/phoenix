/**
 * @generated SignedSource<<c24085b0b6801826bcb1564d76b8ea1b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateDatasetSplitInput = {
  color: string;
  description?: string | null;
  metadata?: any | null;
  name: string;
};
export type NewDatasetSplitDialogCreateSplitMutation$variables = {
  input: CreateDatasetSplitInput;
};
export type NewDatasetSplitDialogCreateSplitMutation$data = {
  readonly createDatasetSplit: {
    readonly datasetSplit: {
      readonly id: string;
      readonly name: string;
    };
  };
};
export type NewDatasetSplitDialogCreateSplitMutation = {
  response: NewDatasetSplitDialogCreateSplitMutation$data;
  variables: NewDatasetSplitDialogCreateSplitMutation$variables;
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
    "concreteType": "DatasetSplitMutationPayload",
    "kind": "LinkedField",
    "name": "createDatasetSplit",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetSplit",
        "kind": "LinkedField",
        "name": "datasetSplit",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "NewDatasetSplitDialogCreateSplitMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "NewDatasetSplitDialogCreateSplitMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "e2f2d371c2b1017d3aecc2d6a77a14ce",
    "id": null,
    "metadata": {},
    "name": "NewDatasetSplitDialogCreateSplitMutation",
    "operationKind": "mutation",
    "text": "mutation NewDatasetSplitDialogCreateSplitMutation(\n  $input: CreateDatasetSplitInput!\n) {\n  createDatasetSplit(input: $input) {\n    datasetSplit {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f38f781f7a16295d3feda764d406d41c";

export default node;
