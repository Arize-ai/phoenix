/**
 * @generated SignedSource<<75c393b1d6d1d353271b06c3e1a7edf1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type DeleteDatasetDialogMutation$variables = {
  datasetId: string;
};
export type DeleteDatasetDialogMutation$data = {
  readonly deleteDataset: {
    readonly __typename: "DatasetMutationPayload";
  };
};
export type DeleteDatasetDialogMutation = {
  response: DeleteDatasetDialogMutation$data;
  variables: DeleteDatasetDialogMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "datasetId",
            "variableName": "datasetId"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
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
        "kind": "ScalarField",
        "name": "__typename",
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
    "name": "DeleteDatasetDialogMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DeleteDatasetDialogMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "3d32b97acd630dd7dbc9c85a632a1d49",
    "id": null,
    "metadata": {},
    "name": "DeleteDatasetDialogMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteDatasetDialogMutation(\n  $datasetId: GlobalID!\n) {\n  deleteDataset(input: {datasetId: $datasetId}) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "7066cca7015a7e344b77862b0bdab21c";

export default node;
