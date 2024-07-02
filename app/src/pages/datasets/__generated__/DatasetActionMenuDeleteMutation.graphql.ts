/**
 * @generated SignedSource<<6ada18701f4f9b63ea990b17751e80ce>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type DatasetActionMenuDeleteMutation$variables = {
  datasetId: string;
};
export type DatasetActionMenuDeleteMutation$data = {
  readonly deleteDataset: {
    readonly __typename: "DatasetMutationPayload";
  };
};
export type DatasetActionMenuDeleteMutation = {
  response: DatasetActionMenuDeleteMutation$data;
  variables: DatasetActionMenuDeleteMutation$variables;
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
    "name": "DatasetActionMenuDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DatasetActionMenuDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "4749f861cca561a1178904c53c396e39",
    "id": null,
    "metadata": {},
    "name": "DatasetActionMenuDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation DatasetActionMenuDeleteMutation(\n  $datasetId: GlobalID!\n) {\n  deleteDataset(input: {datasetId: $datasetId}) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "d98c682a2c908030c2f772209a4a25b8";

export default node;
